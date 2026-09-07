import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { exigirAlcance, misUnidades, normalizarPlaca, vigentes } from './alcance-unidad.js';
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
        ...(opciones.incluirVencidos ? {} : vigentes()),
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
    const unidadIds = await misUnidades(this.prisma, conjuntoId, usuarioId);
    return this.prisma.invitado.findMany({
      where: {
        conjuntoId,
        unidadId: { in: unidadIds },
        ...(incluirVencidos ? {} : vigentes()),
      },
      orderBy: [{ hasta: 'asc' }, { nombre: 'asc' }],
      include: { unidad: { select: { id: true, identificador: true } } },
    });
  }

  async autorizar(activo: ConjuntoActivo, autorId: string, dto: AutorizarInvitadoDto) {
    await this.alcance(activo, autorId, dto.unidadId);

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
        placa: dto.placa ? normalizarPlaca(dto.placa) : null,
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
    await this.alcance(activo, autorId, invitado.unidadId);

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
          ? { placa: dto.placa ? normalizarPlaca(dto.placa) : null }
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
    await this.alcance(activo, autorId, invitado.unidadId);

    if (invitado.hasta && invitado.hasta <= new Date()) {
      throw new BadRequestException('Esa autorizacion ya estaba terminada');
    }
    return this.prisma.invitado.update({ where: { id }, data: { hasta: new Date() } });
  }

  // --- ayudas ---------------------------------------------------------------

  private async obtener(conjuntoId: string, id: string) {
    const invitado = await this.prisma.invitado.findFirst({ where: { id, conjuntoId } });
    if (!invitado) throw new NotFoundException('Invitado no encontrado');
    return invitado;
  }

  /**
   * Alcance de FILA, delegado a `alcance-unidad.ts`.
   *
   * Aqui NO se exige ser propietario, a diferencia de registrar usuarios: los
   * amigos son de quien vive en la unidad, no de quien firma la escritura. Un
   * arrendatario invita a su mama igual que un dueno.
   */
  private alcance(activo: ConjuntoActivo, autorId: string, unidadId: string) {
    return exigirAlcance(
      this.prisma,
      activo,
      autorId,
      unidadId,
      PERMISOS.PORTERIA_INVITADOS_GESTIONAR,
      'Solo puedes autorizar invitados en una unidad tuya',
    );
  }
}
