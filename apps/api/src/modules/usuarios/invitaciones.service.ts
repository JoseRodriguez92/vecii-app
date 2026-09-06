import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { SupabaseAdminService } from '../../auth/supabase-admin.service.js';
import { PERMISOS } from '../../common/permisos.js';
import { EstadoInvitacion, type CodigoRol } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CrearInvitacionDto } from './dto/invitacion.dto.js';

const VIGENCIA_DIAS = 14;

@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  listar(conjuntoId: string) {
    return this.prisma.invitacion.findMany({
      where: { conjuntoId },
      orderBy: { createdAt: 'desc' },
      include: {
        unidad: { select: { id: true, identificador: true } },
        invitadaPor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });
  }

  async crear(activo: ConjuntoActivo, usuarioId: string, dto: CrearInvitacionDto) {
    const puedeTodo = activo.permisos.has(PERMISOS.USUARIOS_INVITAR);

    if (dto.unidadId && !dto.relacion) {
      throw new BadRequestException('Si indicas unidad, tienes que indicar la relacion');
    }
    if (dto.relacion && !dto.unidadId) {
      throw new BadRequestException('La relacion solo tiene sentido junto a una unidad');
    }

    // --- alcance de fila: quien no es administrador solo invita a SUS unidades
    if (!puedeTodo) {
      if (!dto.unidadId) {
        throw new ForbiddenException('Solo puedes invitar a una unidad tuya');
      }
      const esDuenno = await this.prisma.usuarioUnidad.findFirst({
        where: {
          usuarioId,
          unidadId: dto.unidadId,
          relacion: 'PROPIETARIO',
          unidad: { conjuntoId: activo.conjuntoId },
          OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (!esDuenno) {
        throw new ForbiddenException('No eres propietario vigente de esa unidad');
      }
      if (dto.roles?.length) {
        throw new ForbiddenException(
          'Solo la administracion puede otorgar cargos. Puedes invitar a tu unidad, no nombrar roles.',
        );
      }
    }

    if (dto.unidadId) {
      const unidad = await this.prisma.unidad.findFirst({
        where: { id: dto.unidadId, conjuntoId: activo.conjuntoId },
        select: { id: true },
      });
      if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');
    }

    await this.validarRolesOtorgables(dto.roles);

    const expiraEn = new Date(Date.now() + VIGENCIA_DIAS * 24 * 60 * 60 * 1000);

    // Reinvitar reutiliza la fila pendiente en vez de acumular duplicados.
    //
    // No se usa `upsert`: la clave unica incluye `unidadId`, que es nulo cuando
    // se invita a alguien que no vive aqui (un portero), y Prisma no acepta
    // nulos en una busqueda por clave unica compuesta —en Postgres los NULL son
    // distintos entre si, asi que no hay nada que buscar—. En un `findFirst` el
    // nulo si funciona como filtro.
    const pendiente = await this.prisma.invitacion.findFirst({
      where: {
        conjuntoId: activo.conjuntoId,
        email: dto.email,
        unidadId: dto.unidadId ?? null,
        estado: EstadoInvitacion.PENDIENTE,
      },
      select: { id: true },
    });

    const datos = {
      relacion: dto.relacion ?? null,
      roles: dto.roles ?? [],
      expiraEn,
    };

    const invitacion = pendiente
      ? await this.prisma.invitacion.update({ where: { id: pendiente.id }, data: datos })
      : await this.prisma.invitacion.create({
          data: {
            ...datos,
            conjuntoId: activo.conjuntoId,
            email: dto.email,
            unidadId: dto.unidadId ?? null,
            invitadaPorId: usuarioId,
          },
        });

    const { yaExistia } = await this.supabase.invitarPorCorreo(dto.email);

    return {
      ...invitacion,
      mensaje: yaExistia
        ? 'Esa persona ya tiene cuenta. La invitacion se le aplicara al iniciar sesion.'
        : 'Invitacion enviada por correo.',
    };
  }

  async cancelar(conjuntoId: string, id: string) {
    const invitacion = await this.prisma.invitacion.findFirst({ where: { id, conjuntoId } });
    if (!invitacion) throw new NotFoundException('Invitacion no encontrada');
    if (invitacion.estado !== EstadoInvitacion.PENDIENTE) {
      throw new BadRequestException(`No se puede cancelar: ya esta ${invitacion.estado}`);
    }
    return this.prisma.invitacion.update({
      where: { id },
      data: { estado: EstadoInvitacion.CANCELADA },
    });
  }

  private async validarRolesOtorgables(roles?: CodigoRol[]) {
    if (!roles?.length) return;
    const encontrados = await this.prisma.rol.findMany({
      where: { codigo: { in: roles } },
      select: { codigo: true, asignable: true, nombre: true },
    });
    const noOtorgables = encontrados.filter((r) => !r.asignable);
    if (noOtorgables.length > 0) {
      throw new BadRequestException(
        `Estos roles no se otorgan a mano: ${noOtorgables.map((r) => r.nombre).join(', ')}. ` +
          'Propietario y residente se derivan de las unidades.',
      );
    }
    if (encontrados.length !== roles.length) {
      throw new BadRequestException('Alguno de los roles indicados no existe');
    }
  }
}
