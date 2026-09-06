import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarInvitadoDto, AutorizarInvitadoDto } from './dto/invitado.dto.js';

@Injectable()
export class InvitadosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que ve porteria: quien puede entrar. Por defecto, solo los vigentes. */
  listar(conjuntoId: string, opciones: { unidadId?: string; incluirVencidos?: boolean } = {}) {
    return this.prisma.invitado.findMany({
      where: {
        conjuntoId,
        ...(opciones.unidadId ? { unidadId: opciones.unidadId } : {}),
        ...(opciones.incluirVencidos ? {} : this.vigentes()),
      },
      orderBy: [{ hasta: 'asc' }, { nombre: 'asc' }],
      include: {
        unidad: { select: { id: true, identificador: true } },
        invitadoPor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });
  }

  /** Los invitados de las unidades donde vive quien pregunta. */
  async mios(conjuntoId: string, usuarioId: string, incluirVencidos = false) {
    const unidadIds = await this.misUnidades(conjuntoId, usuarioId);
    return this.prisma.invitado.findMany({
      where: {
        conjuntoId,
        unidadId: { in: unidadIds },
        ...(incluirVencidos ? {} : this.vigentes()),
      },
      orderBy: [{ hasta: 'asc' }, { nombre: 'asc' }],
      include: { unidad: { select: { id: true, identificador: true } } },
    });
  }

  async autorizar(activo: ConjuntoActivo, autorId: string, dto: AutorizarInvitadoDto) {
    await this.exigirAlcance(activo, autorId, dto.unidadId);

    const desde = dto.desde ? new Date(dto.desde) : new Date();
    const hasta = dto.hasta ? new Date(dto.hasta) : null;
    if (hasta && hasta <= desde) {
      throw new BadRequestException('La autorizacion terminaria antes de empezar');
    }

    return this.prisma.invitado.create({
      data: {
        conjuntoId: activo.conjuntoId,
        unidadId: dto.unidadId,
        nombre: dto.nombre,
        tipoDocumento: dto.tipoDocumento ?? null,
        numeroDocumento: dto.numeroDocumento ?? null,
        telefono: dto.telefono ?? null,
        placa: dto.placa?.toUpperCase().replace(/[\s-]/g, '') ?? null,
        observacion: dto.observacion ?? null,
        invitadoPorId: autorId,
        desde,
        hasta,
      },
    });
  }

  async actualizar(
    activo: ConjuntoActivo,
    autorId: string,
    id: string,
    dto: ActualizarInvitadoDto,
  ) {
    const invitado = await this.obtener(activo.conjuntoId, id);
    await this.exigirAlcance(activo, autorId, invitado.unidadId);

    const desde = dto.desde ? new Date(dto.desde) : invitado.desde;
    const hasta = dto.hasta ? new Date(dto.hasta) : invitado.hasta;
    if (hasta && hasta <= desde) {
      throw new BadRequestException('La autorizacion terminaria antes de empezar');
    }

    return this.prisma.invitado.update({
      where: { id },
      data: {
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.tipoDocumento !== undefined ? { tipoDocumento: dto.tipoDocumento } : {}),
        ...(dto.numeroDocumento !== undefined ? { numeroDocumento: dto.numeroDocumento } : {}),
        ...(dto.telefono !== undefined ? { telefono: dto.telefono } : {}),
        ...(dto.placa !== undefined
          ? { placa: dto.placa?.toUpperCase().replace(/[\s-]/g, '') ?? null }
          : {}),
        ...(dto.observacion !== undefined ? { observacion: dto.observacion } : {}),
        ...(dto.desde ? { desde } : {}),
        ...(dto.hasta ? { hasta } : {}),
      },
    });
  }

  /**
   * Revoca la autorizacion. NO borra la fila: le pone `hasta`.
   *
   * Hace falta poder responder "¿quien tenia permitido entrar en marzo?", que es
   * justo lo que se pregunta cuando algo pasa.
   */
  async revocar(activo: ConjuntoActivo, autorId: string, id: string) {
    const invitado = await this.obtener(activo.conjuntoId, id);
    await this.exigirAlcance(activo, autorId, invitado.unidadId);

    if (invitado.hasta && invitado.hasta <= new Date()) {
      throw new BadRequestException('Esa autorizacion ya estaba terminada');
    }
    return this.prisma.invitado.update({ where: { id }, data: { hasta: new Date() } });
  }

  // --- ayudas ---------------------------------------------------------------

  /** Vigente = ya empezo y no ha terminado. `hasta` null es permanente. */
  private vigentes() {
    const ahora = new Date();
    return { desde: { lte: ahora }, OR: [{ hasta: null }, { hasta: { gt: ahora } }] };
  }

  private async obtener(conjuntoId: string, id: string) {
    const invitado = await this.prisma.invitado.findFirst({ where: { id, conjuntoId } });
    if (!invitado) throw new NotFoundException('Invitado no encontrado');
    return invitado;
  }

  private async misUnidades(conjuntoId: string, usuarioId: string) {
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: { usuarioId, unidad: { conjuntoId }, ...rolVigente() },
      select: { unidadId: true },
    });
    return ocupaciones.map((o) => o.unidadId);
  }

  /**
   * Alcance de FILA. El guard solo sabe razonar a nivel de conjunto.
   *
   * A diferencia de registrar usuarios, aqui NO se exige ser propietario: los
   * amigos son de quien vive en la unidad, no de quien firma la escritura. Un
   * arrendatario invita a su mama igual que un dueno.
   */
  private async exigirAlcance(activo: ConjuntoActivo, autorId: string, unidadId: string) {
    const unidad = await this.prisma.unidad.findFirst({
      where: { id: unidadId, conjuntoId: activo.conjuntoId },
      select: { id: true },
    });
    if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');

    if (activo.permisos.has(PERMISOS.PORTERIA_INVITADOS_GESTIONAR)) return;

    const vive = await this.prisma.usuarioUnidad.findFirst({
      where: { usuarioId: autorId, unidadId, ...rolVigente() },
      select: { id: true },
    });
    if (!vive) throw new ForbiddenException('Solo puedes autorizar invitados en una unidad tuya');
  }
}
