import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TipoNotificacion } from '../../generated/prisma/enums.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { normalizarPlaca } from '../../common/placa.js';
import { misUnidades } from '../../common/mis-unidades.js';
import { exigirAlcance, vigentes } from './registros.js';
import type { ActualizarInvitadoDto, AutorizarInvitadoDto } from './dto/invitado.dto.js';

@Injectable()
export class InvitadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: NotificacionesService,
  ) {}

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

  /**
   * Un invitado solo, el que abre un aviso de la campanita.
   *
   * Quien lo puede ver es la misma pregunta que responde `mios`: porteria ve
   * todos los del conjunto, el residente solo los de sus unidades.
   *
   * Si no lo puede ver responde 404 y no 403, igual que en encomiendas y
   * reservas: un 403 confirmaria que el id existe, y con eso se puede ir
   * probando ids hasta saber a quien recibe otra unidad.
   */
  async obtener(activo: ConjuntoActivo, usuarioId: string, id: string) {
    const veTodoElConjunto = activo.permisos.has(PERMISOS.PORTERIA_LEER);

    const invitado = await this.prisma.invitado.findFirst({
      where: {
        id,
        conjuntoId: activo.conjuntoId,
        ...(veTodoElConjunto
          ? {}
          : { unidadId: { in: await misUnidades(this.prisma, activo.conjuntoId, usuarioId) } }),
      },
      include: { unidad: { select: { id: true, identificador: true } } },
    });

    if (!invitado) throw new NotFoundException('Invitado no encontrado');
    return invitado;
  }

  async autorizar(activo: ConjuntoActivo, autorId: string, dto: AutorizarInvitadoDto) {
    await this.alcance(activo, autorId, dto.unidadId);

    const desde = dto.desde ? new Date(dto.desde) : new Date();
    const hasta = dto.hasta ? new Date(dto.hasta) : null;
    if (hasta && hasta <= desde) {
      throw new BadRequestException('La autorizacion terminaria antes de empezar');
    }

    const invitado = await this.prisma.invitado.create({
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

    // Le llega a los demas de la unidad, no a quien autorizo. Sirve sobre todo
    // cuando lo autorizo el portero por citofono: "un momento, yo no autorice a
    // nadie" es exactamente la clase de aviso que hace falta.
    await this.avisos.avisar({
      conjuntoId: activo.conjuntoId,
      tipo: TipoNotificacion.INVITADO_AUTORIZADO,
      titulo: `Autorizaron la entrada de ${dto.nombre}`,
      cuerpo: hasta ? undefined : 'Autorizacion permanente',
      entidad: 'invitado',
      entidadId: invitado.id,
      excepto: autorId,
      para: { unidad: dto.unidadId },
    });

    return invitado;
  }

  async actualizar(
    activo: ConjuntoActivo,
    autorId: string,
    id: string,
    dto: ActualizarInvitadoDto,
  ) {
    const invitado = await this.exigirQueExista(activo.conjuntoId, id);
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
    const invitado = await this.exigirQueExista(activo.conjuntoId, id);
    await this.alcance(activo, autorId, invitado.unidadId);

    if (invitado.hasta && invitado.hasta <= new Date()) {
      throw new BadRequestException('Esa autorizacion ya estaba terminada');
    }
    return this.prisma.invitado.update({ where: { id }, data: { hasta: new Date() } });
  }

  // --- ayudas ---------------------------------------------------------------

  /**
   * Trae la fila sin preguntarse de quien es: quien llama comprueba el alcance
   * despues, con `alcance()`. El publico `obtener` es lo contrario — filtra por
   * lo que el que pregunta puede ver.
   */
  private async exigirQueExista(conjuntoId: string, id: string) {
    const invitado = await this.prisma.invitado.findFirst({ where: { id, conjuntoId } });
    if (!invitado) throw new NotFoundException('Invitado no encontrado');
    return invitado;
  }

  /**
   * Alcance de FILA, delegado a `registros.ts`.
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
