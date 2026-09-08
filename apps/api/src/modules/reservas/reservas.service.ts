import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { PERMISOS } from '../../common/permisos.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { EstadoReserva, TipoNotificacion } from '../../generated/prisma/enums.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { OCUPAN, exigirEnCurso, validarCupoLibre } from './ocupacion.js';
import { misUnidades } from '../../common/mis-unidades.js';
import { normalizarPlacaOpcional } from '../../common/placa.js';
import { HORA, solapa, validarHorario, validarPolitica } from './reglas-reserva.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CancelarReservaDto,
  CrearReservaDto,
  RechazarReservaDto,
} from './dto/reserva.dto.js';

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: NotificacionesService,
  ) {}

  listar(
    conjuntoId: string,
    f: {
      espacioId?: string;
      unidadId?: string;
      estado?: EstadoReserva;
      desde?: Date;
      hasta?: Date;
      abiertas?: boolean;
    },
  ) {
    return this.prisma.reserva.findMany({
      where: {
        conjuntoId,
        ...(f.espacioId ? { espacioId: f.espacioId } : {}),
        ...(f.unidadId ? { unidadId: f.unidadId } : {}),
        ...(f.estado ? { estado: f.estado } : {}),
        ...(f.hasta ? { inicio: { lt: f.hasta } } : {}),
        // Una reserva abierta (fin null) sigue vigente hoy: no se puede filtrar
        // por `fin > desde` sin dejarlas afuera.
        ...(f.desde ? { OR: [{ fin: null }, { fin: { gt: f.desde } }] } : {}),
        ...(f.abiertas ? { fin: null, estado: { in: OCUPAN } } : {}),
      },
      orderBy: { inicio: 'asc' },
      include: {
        espacio: { select: { id: true, nombre: true, capacidad: true } },
        unidad: { select: { id: true, identificador: true } },
        solicitadaPor: { select: { id: true, nombres: true, apellidos: true } },
        invitado: { select: { id: true, nombre: true, numeroDocumento: true } },
        parqueadero: { select: { id: true, identificador: true } },
      },
    });
  }

  async mias(conjuntoId: string, usuarioId: string) {
    return this.prisma.reserva.findMany({
      where: { conjuntoId, unidadId: { in: await misUnidades(this.prisma, conjuntoId, usuarioId) } },
      orderBy: { inicio: 'desc' },
      include: {
        espacio: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, identificador: true } },
      },
    });
  }

  /**
   * Una reserva sola, la que abre un aviso de la campanita.
   *
   * Los avisos de reserva —por aprobar, aprobada, rechazada, la que empieza en
   * una hora— guardan `entidad: 'reserva'` y su id. Sin este endpoint el aviso
   * llega, se ve, y al tocarlo no hay a donde ir.
   *
   * Quien la puede ver es la misma pregunta que responde `mias`: quien
   * administra ve todas, y el residente las de sus unidades.
   *
   * Si no la puede ver responde 404 y no 403, igual que en encomiendas e
   * invitados: un 403 confirmaria que el id existe.
   */
  async obtener(activo: ConjuntoActivo, usuarioId: string, id: string) {
    const { conjuntoId } = activo;

    const reserva = await this.prisma.reserva.findFirst({
      where: {
        id,
        conjuntoId,
        ...(this.esAdmin(activo)
          ? {}
          : { unidadId: { in: await misUnidades(this.prisma, conjuntoId, usuarioId) } }),
      },
      include: {
        espacio: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, identificador: true } },
        invitado: { select: { id: true, nombre: true } },
        parqueadero: { select: { id: true, identificador: true } },
      },
    });

    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  /**
   * Aparta un espacio.
   *
   * El choque se resuelve con UNA regla, la misma para el salon comunal y para
   * los 50 cupos de visitantes: `reservas solapadas < capacidad`. El salon es
   * simplemente capacidad 1.
   *
   * El `fin` es obligatorio o no segun a que apunte el espacio, y eso NO es una
   * preferencia: una zona comun se aparta por franja —el salon de 2 a 6— y un
   * cupo de parqueadero se ocupa hasta que la visita se va. Sin `fin` la reserva
   * queda ABIERTA y el cupo sigue tomado hasta que porteria registre la salida.
   */
  async crear(activo: ConjuntoActivo, usuarioId: string, dto: CrearReservaDto) {
    const inicio = new Date(dto.inicio);
    const fin = dto.fin ? new Date(dto.fin) : null;
    if (fin && fin <= inicio) throw new BadRequestException('El fin va despues del inicio');

    const espacio = await this.prisma.espacioReservable.findFirst({
      where: { id: dto.espacioId, conjuntoId: activo.conjuntoId },
      include: { politica: true, zonaComun: { include: { horarios: true } } },
    });
    if (!espacio) throw new NotFoundException('Ese espacio reservable no existe en este conjunto');
    if (!espacio.activo) throw new BadRequestException(`"${espacio.nombre}" esta fuera de servicio`);

    // Derivado, no configurado: una sala se aparta por franja, un cupo se ocupa.
    if (espacio.zonaComunId && !fin) {
      throw new BadRequestException(
        `"${espacio.nombre}" es una zona comun: se aparta por franja y hay que decir hasta cuando`,
      );
    }

    const relacion = await this.exigirAlcance(activo, usuarioId, dto.unidadId);
    const politica = espacio.politica;

    if (politica?.soloPropietarios && relacion !== 'PROPIETARIO' && !this.esAdmin(activo)) {
      throw new ForbiddenException(`"${espacio.nombre}" solo lo pueden reservar los propietarios`);
    }

    validarPolitica(espacio.nombre, politica, inicio, fin);
    if (fin) validarHorario(espacio.zonaComun, inicio, fin);
    await this.validarCuposDeLaUnidad(politica, dto.unidadId, dto.espacioId, inicio);
    if (dto.invitadoId) await this.validarInvitado(activo.conjuntoId, dto.invitadoId, dto.unidadId);

    const estado = politica?.requiereAprobacion
      ? EstadoReserva.SOLICITADA
      : EstadoReserva.CONFIRMADA;

    const reserva = await this.prisma.$transaction(async (tx) => {
      // Sin este candado, dos residentes que aparten el ultimo cupo en el mismo
      // segundo cuentan los dos "queda 1" y los dos crean su fila. Contar y
      // luego insertar NO es atomico por si solo.
      //
      // Es un lock de TRANSACCION: se suelta solo al terminar, asi que funciona
      // igual detras del pooler de Supabase. Serializa unicamente las reservas
      // del mismo espacio.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dto.espacioId}::text, 0::bigint))`;

      const solapadas = await tx.reserva.count({
        where: { espacioId: dto.espacioId, estado: { in: OCUPAN }, ...solapa(inicio, fin) },
      });
      if (solapadas >= espacio.capacidad) {
        throw new BadRequestException(
          espacio.capacidad === 1
            ? `"${espacio.nombre}" ya esta reservado en esa franja`
            : `No quedan cupos en "${espacio.nombre}" para esa franja (${espacio.capacidad} en total)`,
        );
      }

      if (dto.parqueaderoId) {
        await validarCupoLibre(tx, activo.conjuntoId, espacio, dto.parqueaderoId, inicio, fin);
      }

      return await tx.reserva.create({
        data: {
          conjuntoId: activo.conjuntoId,
          espacioId: dto.espacioId,
          unidadId: dto.unidadId,
          solicitadaPorId: usuarioId,
          invitadoId: dto.invitadoId ?? null,
          parqueaderoId: dto.parqueaderoId ?? null,
          placa: normalizarPlacaOpcional(dto.placa),
          inicio,
          fin,
          estado,
          observacion: dto.observacion ?? null,
        },
      });
    });

    // Los avisos van FUERA de la transaccion, a proposito. Adentro alargarian el
    // candado del espacio —que serializa a todos los que aparten esa misma
    // cosa— por el tiempo de escribir decenas de filas. Y si fallaran, harian
    // rollback de una reserva perfectamente valida.
    if (reserva.estado === EstadoReserva.SOLICITADA) {
      await this.avisos.avisar({
        conjuntoId: activo.conjuntoId,
        tipo: TipoNotificacion.RESERVA_POR_APROBAR,
        titulo: `Hay una reserva por aprobar en ${espacio.nombre}`,
        cuerpo: this.franja(inicio, fin),
        entidad: 'reserva',
        entidadId: reserva.id,
        excepto: usuarioId,
        // A quien PUEDA aprobarla, sea cual sea su cargo. Si manana el conjunto
        // inventa un comite con ese permiso, le llega solo.
        para: { permiso: PERMISOS.RESERVAS_ADMINISTRAR },
      });
    }

    // El recordatorio: se crea ahora y se ve una hora antes. Sin cron.
    //
    // Solo si falta mas de esa hora — apartar el salon para dentro de veinte
    // minutos no necesita que le recuerden nada. Y solo si hay `fin`: un cupo de
    // parqueadero se OCUPA cuando el carro llega, no se espera.
    const recordatorio = new Date(inicio.getTime() - HORA);
    if (fin && recordatorio > new Date()) {
      await this.avisos.avisar({
        conjuntoId: activo.conjuntoId,
        tipo: TipoNotificacion.RESERVA_PROXIMA,
        titulo: `Tu reserva de ${espacio.nombre} es dentro de una hora`,
        cuerpo: this.franja(inicio, fin),
        entidad: 'reserva',
        entidadId: reserva.id,
        programadaPara: recordatorio,
        para: { persona: usuarioId },
      });
    }

    return reserva;
  }

  /** "de 2:00 p. m. a 6:00 p. m." — como lo diria alguien, no como lo guarda Postgres. */
  private franja(inicio: Date, fin: Date | null): string {
    const hora = (d: Date) =>
      d.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
      });
    return fin ? `${hora(inicio)} — ${hora(fin)}` : `Desde ${hora(inicio)}`;
  }

  async aprobar(conjuntoId: string, usuarioId: string, id: string) {
    const reserva = await exigirEnCurso(this.prisma, conjuntoId, id);
    if (reserva.estado !== EstadoReserva.SOLICITADA) {
      throw new BadRequestException('Esa reserva no esta esperando aprobacion');
    }
    const aprobada = await this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CONFIRMADA,
        aprobadaPorId: usuarioId,
        aprobadaEn: new Date(),
      },
      include: { espacio: { select: { nombre: true } } },
    });

    await this.avisos.avisar({
      conjuntoId,
      tipo: TipoNotificacion.RESERVA_APROBADA,
      titulo: `Te aprobaron la reserva de ${aprobada.espacio.nombre}`,
      cuerpo: this.franja(aprobada.inicio, aprobada.fin),
      entidad: 'reserva',
      entidadId: id,
      para: { persona: reserva.solicitadaPorId },
    });

    return aprobada;
  }

  async rechazar(conjuntoId: string, usuarioId: string, id: string, dto: RechazarReservaDto) {
    const reserva = await exigirEnCurso(this.prisma, conjuntoId, id);
    if (reserva.estado !== EstadoReserva.SOLICITADA) {
      throw new BadRequestException('Esa reserva no esta esperando aprobacion');
    }
    const rechazada = await this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CANCELADA,
        motivoRechazo: dto.motivo,
        aprobadaPorId: usuarioId,
        aprobadaEn: new Date(),
      },
      include: { espacio: { select: { nombre: true } } },
    });

    await this.avisos.avisar({
      conjuntoId,
      tipo: TipoNotificacion.RESERVA_RECHAZADA,
      titulo: `No te aprobaron la reserva de ${rechazada.espacio.nombre}`,
      cuerpo: dto.motivo,
      entidad: 'reserva',
      entidadId: id,
      para: { persona: reserva.solicitadaPorId },
    });

    // Ya no va a haber reserva: el recordatorio programado sobra. Es el unico
    // borrado de esa tabla, y esta bien que lo sea — un aviso que nadie llego a
    // ver no es un hecho que haya pasado.
    await this.avisos.cancelarProgramados('reserva', id);

    return rechazada;
  }

  /**
   * Cancela. Quien no administra solo cancela las de SUS unidades, y respetando
   * la antelacion minima del reglamento.
   */
  async cancelar(
    activo: ConjuntoActivo,
    usuarioId: string,
    id: string,
    dto: CancelarReservaDto,
  ) {
    const reserva = await exigirEnCurso(this.prisma, activo.conjuntoId, id);

    if (!activo.permisos.has(PERMISOS.RESERVAS_ADMINISTRAR)) {
      await this.exigirAlcance(activo, usuarioId, reserva.unidadId);

      const politica = await this.prisma.politicaReserva.findFirst({
        where: { espacioId: reserva.espacioId },
        select: { cancelacionMinimaHoras: true },
      });
      const minimas = politica?.cancelacionMinimaHoras;
      if (minimas && reserva.inicio.getTime() - Date.now() < minimas * HORA) {
        throw new BadRequestException(
          `Ya pasó el plazo para cancelar sin sancion (${minimas} horas antes). ` +
            'Pidele a la administracion que la cancele.',
        );
      }
    }

    const cancelada = await this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CANCELADA,
        ...(dto.motivo ? { motivoRechazo: dto.motivo } : {}),
      },
    });

    await this.avisos.cancelarProgramados('reserva', id);

    return cancelada;
  }

  /**
   * Reservo y no aparecio. Se guarda porque muchos reglamentos sancionan la
   * inasistencia reiterada, y sin el dato no hay como aplicarlo.
   */
  async marcarNoAsistio(conjuntoId: string, id: string) {
    const reserva = await this.prisma.reserva.findFirst({ where: { id, conjuntoId } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.estado !== EstadoReserva.CONFIRMADA) {
      throw new BadRequestException('Solo una reserva confirmada puede quedar como no asistida');
    }
    if (!reserva.fin) {
      throw new BadRequestException(
        'Esa reserva esta abierta: si nadie llego, se cancela; no aplica "no asistio"',
      );
    }
    if (reserva.fin > new Date()) {
      throw new BadRequestException('Esa reserva todavia no ha terminado');
    }
    return this.prisma.reserva.update({
      where: { id },
      data: { estado: EstadoReserva.NO_ASISTIO },
    });
  }

  // --- validaciones ---------------------------------------------------------

  private esAdmin(activo: ConjuntoActivo) {
    return activo.permisos.has(PERMISOS.RESERVAS_ADMINISTRAR);
  }

  private async validarCuposDeLaUnidad(
    politica: { maxSimultaneasPorUnidad: number | null; maxMensualesPorUnidad: number | null } | null,
    unidadId: string,
    espacioId: string,
    inicio: Date,
  ) {
    if (!politica) return;

    if (politica.maxSimultaneasPorUnidad) {
      const activas = await this.prisma.reserva.count({
        where: { espacioId, unidadId, estado: { in: OCUPAN }, fin: { gt: new Date() } },
      });
      if (activas >= politica.maxSimultaneasPorUnidad) {
        throw new BadRequestException(
          `Esa unidad ya tiene ${activas} reserva(s) activa(s) y el maximo es ${politica.maxSimultaneasPorUnidad}`,
        );
      }
    }

    if (politica.maxMensualesPorUnidad) {
      const desde = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
      const hasta = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
      const delMes = await this.prisma.reserva.count({
        where: {
          espacioId,
          unidadId,
          estado: { in: [...OCUPAN, EstadoReserva.CUMPLIDA, EstadoReserva.NO_ASISTIO] },
          inicio: { gte: desde, lt: hasta },
        },
      });
      if (delMes >= politica.maxMensualesPorUnidad) {
        throw new BadRequestException(
          `Esa unidad ya lleva ${delMes} reserva(s) este mes y el maximo es ${politica.maxMensualesPorUnidad}`,
        );
      }
    }
  }

  /** El invitado tiene que ser de la misma unidad que responde por la reserva. */
  private async validarInvitado(conjuntoId: string, invitadoId: string, unidadId: string) {
    const invitado = await this.prisma.invitado.findFirst({
      where: { id: invitadoId, conjuntoId },
      select: { unidadId: true, nombre: true, hasta: true },
    });
    if (!invitado) throw new NotFoundException('Ese invitado no existe en este conjunto');
    if (invitado.unidadId !== unidadId) {
      throw new BadRequestException(`${invitado.nombre} esta autorizado en otra unidad`);
    }
    if (invitado.hasta && invitado.hasta <= new Date()) {
      throw new BadRequestException(`La autorizacion de ${invitado.nombre} ya termino`);
    }
  }

  /** Devuelve la relacion con la unidad, que hace falta para `soloPropietarios`. */
  private async exigirAlcance(activo: ConjuntoActivo, usuarioId: string, unidadId: string) {
    const unidad = await this.prisma.unidad.findFirst({
      where: { id: unidadId, conjuntoId: activo.conjuntoId },
      select: { id: true },
    });
    if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');

    // Una persona puede tener dos relaciones con la misma unidad (dueno que
    // ademas vive ahi). Se ordena por el enum, cuyo primer valor es PROPIETARIO,
    // para quedarse con la mas fuerte: es la que decide `soloPropietarios`.
    const ocupacion = await this.prisma.usuarioUnidad.findFirst({
      where: { usuarioId, unidadId, ...rolVigente() },
      orderBy: { relacion: 'asc' },
      select: { relacion: true },
    });

    if (!ocupacion) {
      if (this.esAdmin(activo)) return null;
      throw new ForbiddenException('Solo puedes reservar para una unidad tuya');
    }
    return ocupacion.relacion;
  }
}
