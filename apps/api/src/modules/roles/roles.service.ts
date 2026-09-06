import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PermisosService } from '../../auth/permisos.service.js';
import { PERMISOS } from '../../common/permisos.js';
import { Ambito, ROL } from '../../common/roles.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarRolDto, ReemplazarPermisosDto } from './dto/rol.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  /** El catalogo de permisos agrupado por modulo: para pintar la pantalla. */
  listarModulos() {
    return this.prisma.modulo.findMany({
      where: { activo: true },
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
  async listar(activo: ConjuntoActivo) {
    const roles = await this.prisma.rol.findMany({
      where: activo.esDePlataforma ? {} : { ambito: Ambito.CONJUNTO },
      orderBy: { codigo: 'asc' },
      include: { permisos: { select: { permiso: { select: { codigo: true } } } } },
    });
    return roles.map((r) => ({
      ...r,
      permisos: r.permisos.map((p) => p.permiso.codigo).sort(),
    }));
  }

  async actualizar(codigo: string, dto: ActualizarRolDto) {
    const rol = await this.obtener(codigo);
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
    // Hoy la matriz es GLOBAL: `roles` no tiene conjunto y `roles_permisos`
    // tampoco. Sin este candado, el administrador de un conjunto cambiaria lo
    // que puede hacer el consejo de TODOS los conjuntos del pais.
    //
    // Es el mismo error que PATCH /conjuntos/:id: autorizar a nivel de conjunto
    // y escribir a nivel global. Se levanta cuando los roles sean por conjunto.
    // Ver docs/pendientes.md.
    if (!activo.roles.includes(ROL.STAFF_VECII)) {
      throw new ForbiddenException(
        'La matriz de permisos es global y hoy solo la edita el equipo de Vecii. ' +
          'Los roles por conjunto estan en camino.',
      );
    }

    const rol = await this.obtener(codigo);

    // SUPER_ADMIN es staff de Vecii, no un cargo del conjunto. Si se pudiera
    // editar desde aqui, un administrador podria quitarle el acceso al equipo
    // que sostiene la plataforma.
    if (codigo === ROL.STAFF_VECII) {
      throw new BadRequestException('Los permisos de SUPER_ADMIN no se editan desde la interfaz');
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

  private async obtener(codigo: string) {
    // TODO (paso 2): cuando los roles sean por conjunto, `conjuntoId: null` pasa
    // a ser el conjunto activo. Hoy todos los roles son globales.
    const rol = await this.prisma.rol.findFirst({ where: { codigo, conjuntoId: null } });
    if (!rol) throw new NotFoundException(`No existe el rol ${codigo}`);
    return rol;
  }
}
