import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PermisosService } from '../../auth/permisos.service.js';
import { PERMISOS } from '../../common/permisos.js';
import { CodigoRol } from '../../generated/prisma/enums.js';
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

  async listar() {
    const roles = await this.prisma.rol.findMany({
      orderBy: { codigo: 'asc' },
      include: { permisos: { select: { permiso: { select: { codigo: true } } } } },
    });
    return roles.map((r) => ({
      ...r,
      permisos: r.permisos.map((p) => p.permiso.codigo).sort(),
    }));
  }

  async actualizar(codigo: CodigoRol, dto: ActualizarRolDto) {
    await this.obtener(codigo);
    return this.prisma.rol.update({ where: { codigo }, data: dto });
  }

  /**
   * Reemplaza la lista completa de permisos de un rol.
   *
   * Es el punto entero de la tabla `roles_permisos`: cambiar quien puede hacer
   * que sin desplegar codigo.
   */
  async reemplazarPermisos(codigo: CodigoRol, dto: ReemplazarPermisosDto) {
    const rol = await this.obtener(codigo);

    // SUPER_ADMIN es staff de Vecii, no un cargo del conjunto. Si se pudiera
    // editar desde aqui, un administrador podria quitarle el acceso al equipo
    // que sostiene la plataforma.
    if (codigo === CodigoRol.SUPER_ADMIN) {
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
  private async exigirQueAlguienPuedaSeguirEditando(codigo: CodigoRol, nuevos: string[]) {
    if (nuevos.includes(PERMISOS.ROLES_GESTIONAR)) return;

    const otros = await this.prisma.rolPermiso.count({
      where: {
        permiso: { codigo: PERMISOS.ROLES_GESTIONAR },
        rol: { codigo: { notIn: [codigo, CodigoRol.SUPER_ADMIN] } },
      },
    });
    if (otros === 0) {
      throw new BadRequestException(
        `Si le quitas "${PERMISOS.ROLES_GESTIONAR}" a ${codigo} no queda ningun rol que pueda ` +
          'editar los permisos, y esta pantalla dejaria de funcionar para siempre.',
      );
    }
  }

  private async obtener(codigo: CodigoRol) {
    const rol = await this.prisma.rol.findUnique({ where: { codigo } });
    if (!rol) throw new NotFoundException(`No existe el rol ${codigo}`);
    return rol;
  }
}
