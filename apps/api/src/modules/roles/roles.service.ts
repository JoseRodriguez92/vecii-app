import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PermisosService } from '../../auth/permisos.service.js';
import { PERMISOS, PERMISOS_DE_PLATAFORMA } from '../../common/permisos.js';
import { Ambito, CODIGOS_RESERVADOS, ROL } from '../../common/roles.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ActualizarRolDto,
  CrearRolDto,
  ReemplazarPermisosDto,
} from './dto/rol.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  /**
   * El catalogo de permisos agrupado por modulo: para pintar la pantalla.
   *
   * Un modulo de PLATAFORMA no se le muestra al conjunto. Si apareciera, el
   * administrador veria la casilla "Nombrar staff de Vecii" entre las suyas y
   * podria marcarsela a su propio consejo.
   */
  listarModulos(activo: ConjuntoActivo) {
    return this.prisma.modulo.findMany({
      where: { activo: true, ...(activo.esDePlataforma ? {} : { ambito: Ambito.CONJUNTO }) },
      orderBy: { orden: 'asc' },
      include: { permisos: { orderBy: { codigo: 'asc' } } },
    });
  }

  /**
   * Los roles que le tocan a quien pregunta.
   *
   * Un rol de PLATAFORMA no tiene nada que hacer en la pantalla del
   * administrador de un conjunto: no lo puede otorgar, no lo puede editar, y
   * verlo en el desplegable solo invita a intentarlo. Se filtra aqui y no en el
   * frontend, porque la interfaz no deberia tener que saber esta regla.
   */
  /**
   * Crea un cargo propio del conjunto.
   *
   * Nace SIN permisos: se le marcan despues. Y nace con el conjunto adentro, asi
   * que sus permisos ya son suyos — el aislamiento lo trae el rol, no hace falta
   * ninguna regla extra.
   */
  async crear(activo: ConjuntoActivo, dto: CrearRolDto) {
    if (CODIGOS_RESERVADOS.has(dto.codigo)) {
      throw new BadRequestException(
        `${dto.codigo} es un cargo del sistema. Elige otro codigo para el tuyo.`,
      );
    }

    const repetido = await this.prisma.rol.findFirst({
      where: { codigo: dto.codigo, conjuntoId: activo.conjuntoId },
      select: { id: true },
    });
    if (repetido) throw new BadRequestException(`Ya tienes un cargo con el codigo ${dto.codigo}`);

    return this.prisma.rol.create({
      data: {
        codigo: dto.codigo,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        conjuntoId: activo.conjuntoId,
        ambito: Ambito.CONJUNTO,
        asignable: true,
      },
    });
  }

  /**
   * Da de baja un cargo propio. No borra la fila: las asignaciones historicas la
   * apuntan, y "quien era del comite cuando se aprobo eso" se sigue preguntando.
   * Cierra las vigentes y le quita los permisos.
   */
  async desactivar(activo: ConjuntoActivo, codigo: string) {
    const rol = await this.exigirPropio(activo, codigo);
    const cerrados = await this.prisma.usuarioConjuntoRol.updateMany({
      where: { rolId: rol.id, hasta: null },
      data: { hasta: new Date() },
    });
    await this.prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } });
    this.permisos.invalidarCache();
    return { codigo, cargosCerrados: cerrados.count };
  }

  async listar(activo: ConjuntoActivo) {
    const roles = await this.prisma.rol.findMany({
      where: activo.esDePlataforma
        ? {}
        : {
            ambito: Ambito.CONJUNTO,
            // Los estandar (sin conjunto) y los propios de este. Los cargos que
            // invento OTRO conjunto no se ven: no existen para el.
            OR: [{ conjuntoId: null }, { conjuntoId: activo.conjuntoId }],
          },
      orderBy: { codigo: 'asc' },
      include: { permisos: { select: { permiso: { select: { codigo: true } } } } },
    });
    return roles.map((r) => ({
      ...r,
      permisos: r.permisos.map((p) => p.permiso.codigo).sort(),
    }));
  }

  async actualizar(activo: ConjuntoActivo, codigo: string, dto: ActualizarRolDto) {
    const rol = activo.esDePlataforma
      ? await this.obtener(codigo)
      : await this.exigirPropio(activo, codigo);
    return this.prisma.rol.update({ where: { id: rol.id }, data: dto });
  }

  /**
   * Reemplaza la lista completa de permisos de un rol.
   *
   * Es el punto entero de la tabla `roles_permisos`: cambiar quien puede hacer
   * que sin desplegar codigo.
   */
  async reemplazarPermisos(
    activo: ConjuntoActivo,
    codigo: string,
    dto: ReemplazarPermisosDto,
  ) {
    // Un conjunto edita SUS cargos, no los estandar. Los estandar salen de la
    // Ley 675 y son los mismos en todo el pais: si Parques quiere un consejo
    // distinto, se crea su propio cargo. Vecii si puede editar los estandar.
    const rol = activo.esDePlataforma
      ? await this.obtener(codigo)
      : await this.exigirPropio(activo, codigo);

    // STAFF_VECII no se edita desde ninguna interfaz: si se pudiera, alguien
    // podria dejar sin acceso al equipo que sostiene la plataforma.
    if (rol.codigo === ROL.STAFF_VECII) {
      throw new BadRequestException('Los permisos de STAFF_VECII no se editan desde la interfaz');
    }

    const existentes = await this.prisma.permiso.findMany({
      where: { codigo: { in: dto.permisos } },
      select: { id: true, codigo: true },
    });
    if (existentes.length !== dto.permisos.length) {
      const encontrados = new Set(existentes.map((p) => p.codigo));
      const inventados = dto.permisos.filter((c) => !encontrados.has(c));
      throw new BadRequestException(`Estos permisos no existen: ${inventados.join(', ')}`);
    }

    // Esconderlo en la pantalla no es protegerlo: quien mande el permiso a mano
    // por la API tiene que recibir un no.
    if (!activo.esDePlataforma) {
      const dePlataforma = dto.permisos.filter((c) => PERMISOS_DE_PLATAFORMA.has(c));
      if (dePlataforma.length > 0) {
        throw new ForbiddenException(
          `Estos permisos son de la plataforma y solo los otorga Vecii: ${dePlataforma.join(', ')}`,
        );
      }
    }

    await this.exigirQueAlguienPuedaSeguirEditando(codigo, dto.permisos);

    await this.prisma.$transaction([
      this.prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } }),
      this.prisma.rolPermiso.createMany({
        data: existentes.map((p) => ({ rolId: rol.id, permisoId: p.id })),
      }),
    ]);

    // Sin esto el cambio tarda hasta cinco minutos en verse: el mapa
    // rol -> permisos se cachea en memoria porque se consulta en cada peticion.
    this.permisos.invalidarCache();

    return { codigo, permisos: dto.permisos.sort() };
  }

  /**
   * Impide el suicidio: que nadie quede pudiendo editar esta matriz.
   *
   * Si el unico rol con `roles.gestionar` se lo quita a si mismo, la pantalla de
   * permisos deja de ser editable para siempre y solo se arregla con SQL a mano.
   * SUPER_ADMIN no cuenta como salvavidas: es staff de Vecii, no del conjunto.
   */
  private async exigirQueAlguienPuedaSeguirEditando(codigo: string, nuevos: string[]) {
    if (nuevos.includes(PERMISOS.ROLES_GESTIONAR)) return;

    const otros = await this.prisma.rolPermiso.count({
      where: {
        permiso: { codigo: PERMISOS.ROLES_GESTIONAR },
        rol: { codigo: { notIn: [codigo, ROL.STAFF_VECII] } },
      },
    });
    if (otros === 0) {
      throw new BadRequestException(
        `Si le quitas "${PERMISOS.ROLES_GESTIONAR}" a ${codigo} no queda ningun rol que pueda ` +
          'editar los permisos, y esta pantalla dejaria de funcionar para siempre.',
      );
    }
  }

  /**
   * Exige que el cargo sea de ESTE conjunto.
   *
   * Es lo que impide que el administrador de Parques toque el CONSEJO estandar
   * —que comparten los 400— o un cargo inventado por otro conjunto.
   */
  private async exigirPropio(activo: ConjuntoActivo, codigo: string) {
    const rol = await this.prisma.rol.findFirst({
      where: { codigo, conjuntoId: activo.conjuntoId },
    });
    if (rol) return rol;

    const estandar = await this.prisma.rol.findFirst({
      where: { codigo, conjuntoId: null },
      select: { nombre: true },
    });
    if (estandar) {
      throw new ForbiddenException(
        `${estandar.nombre} es un cargo del sistema y lo comparten todos los conjuntos. ` +
          'Si necesitas uno distinto, crea el tuyo.',
      );
    }
    throw new NotFoundException(`No tienes un cargo con el codigo ${codigo}`);
  }

  private async obtener(codigo: string) {
    // TODO (paso 2): cuando los roles sean por conjunto, `conjuntoId: null` pasa
    // a ser el conjunto activo. Hoy todos los roles son globales.
    const rol = await this.prisma.rol.findFirst({ where: { codigo, conjuntoId: null } });
    if (!rol) throw new NotFoundException(`No existe el rol ${codigo}`);
    return rol;
  }
}
