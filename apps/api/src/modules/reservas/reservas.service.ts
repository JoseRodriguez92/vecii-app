import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { diaYMinutos, formatearHora } from '../../common/hora-minutos.js';
import { PERMISOS } from '../../common/permisos.js';
import { rolVigente } from '../../common/rol-vigente.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  EstadoReserva,
  type NaturalezaParqueadero,
  TipoNotificacion,
} from '../../generated/prisma/enums.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AsignarCupoDto,
  CancelarReservaDto,
  CrearReservaDto,
  RechazarReservaDto,
  RegistrarSalidaDto,
} from './dto/reserva.dto.js';

/** Estados que ocupan cupo. Una cancelada o rechazada libera el espacio. */
const OCUPAN: EstadoReserva[] = [EstadoReserva.SOLICITADA, EstadoReserva.CONFIRMADA];

const HORA = 60 * 60 * 1000;

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
    const ocupaciones = await this.prisma.usuarioUnidad.findMany({
      where: { usuarioId, unidad: { conjuntoId }, ...rolVigente() },
      select: { unidadId: true },
    });
    return this.prisma.reserva.findMany({
      where: { conjuntoId, unidadId: { in: ocupaciones.map((o) => o.unidadId) } },
      orderBy: { inicio: 'desc' },
      include: {
        espacio: { select: { id: true, nombre: true } },
        unidad: { select: { id: true, identificador: true } },
      },
    });
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

    this.validarPolitica(espacio.nombre, politica, inicio, fin);
    if (fin) this.validarHorario(espacio.zonaComun, inicio, fin);
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
        where: { espacioId: dto.espacioId, estado: { in: OCUPAN }, ...this.solapa(inicio, fin) },
      });
      if (solapadas >= espacio.capacidad) {
        throw new BadRequestException(
          espacio.capacidad === 1
            ? `"${espacio.nombre}" ya esta reservado en esa franja`
            : `No quedan cupos en "${espacio.nombre}" para esa franja (${espacio.capacidad} en total)`,
        );
      }

      if (dto.parqueaderoId) {
        await this.validarCupoLibre(tx, activo.conjuntoId, espacio, dto.parqueaderoId, inicio, fin);
      }

      return await tx.reserva.create({
        data: {
          conjuntoId: activo.conjuntoId,
          espacioId: dto.espacioId,
          unidadId: dto.unidadId,
          solicitadaPorId: usuarioId,
          invitadoId: dto.invitadoId ?? null,
          parqueaderoId: dto.parqueaderoId ?? null,
          placa: this.normalizarPlaca(dto.placa),
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

  /**
   * Le asigna el cupo concreto cuando llega el carro. La reserva apartaba "un
   * espacio del pool"; esto dice cual le toco.
   */
  async asignarCupo(conjuntoId: string, id: string, dto: AsignarCupoDto) {
    const reserva = await this.exigirEnCurso(conjuntoId, id);
    const espacio = await this.prisma.espacioReservable.findFirstOrThrow({
      where: { id: reserva.espacioId },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reserva.espacioId}::text, 0::bigint))`;
      await this.validarCupoLibre(
        tx,
        conjuntoId,
        espacio,
        dto.parqueaderoId,
        reserva.inicio,
        reserva.fin,
        id,
      );
      return tx.reserva.update({
        where: { id },
        data: {
          parqueaderoId: dto.parqueaderoId,
          ...(dto.placa ? { placa: this.normalizarPlaca(dto.placa) } : {}),
        },
      });
    });
  }

  /**
   * La salida: cierra una reserva abierta y libera el cupo.
   *
   * De aqui sale cuanto se cobra —desde `inicio` hasta ahora—, pero el valor NO
   * se guarda: el hecho son las dos horas, y el cargo lo genera finanzas. Si
   * manana corrigen una hora mal digitada, el valor se recalcula solo.
   */
  async registrarSalida(conjuntoId: string, id: string, dto: RegistrarSalidaDto) {
    const reserva = await this.exigirEnCurso(conjuntoId, id);
    if (reserva.fin) {
      throw new BadRequestException(
        'Esa reserva tiene fin definido: no se cierra con una salida, se cumple o se cancela',
      );
    }

    const salida = dto.salidaEn ? new Date(dto.salidaEn) : new Date();
    if (Number.isNaN(salida.getTime())) throw new BadRequestException('Fecha invalida');
    if (salida <= reserva.inicio) {
      throw new BadRequestException('La salida seria anterior a la entrada');
    }

    const actualizada = await this.prisma.reserva.update({
      where: { id },
      data: { fin: salida, estado: EstadoReserva.CUMPLIDA },
    });

    return {
      ...actualizada,
      minutos: Math.ceil((salida.getTime() - reserva.inicio.getTime()) / 60000),
    };
  }

  async aprobar(conjuntoId: string, usuarioId: string, id: string) {
    const reserva = await this.exigirEnCurso(conjuntoId, id);
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
    const reserva = await this.exigirEnCurso(conjuntoId, id);
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
    const reserva = await this.exigirEnCurso(activo.conjuntoId, id);

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

  private validarPolitica(
    nombre: string,
    politica: { anticipacionMinimaHoras: number | null; anticipacionMaximaDias: number | null; duracionMinimaMinutos: number | null; duracionMaximaMinutos: number | null } | null,
    inicio: Date,
    fin: Date | null,
  ) {
    if (inicio.getTime() < Date.now()) {
      throw new BadRequestException('No se puede reservar hacia atras');
    }
    if (!politica) return;

    const horasDeAnticipacion = (inicio.getTime() - Date.now()) / HORA;
    if (politica.anticipacionMinimaHoras && horasDeAnticipacion < politica.anticipacionMinimaHoras) {
      throw new BadRequestException(
        `"${nombre}" se reserva con al menos ${politica.anticipacionMinimaHoras} horas de anticipacion`,
      );
    }
    if (politica.anticipacionMaximaDias && horasDeAnticipacion > politica.anticipacionMaximaDias * 24) {
      throw new BadRequestException(
        `"${nombre}" no se puede reservar con mas de ${politica.anticipacionMaximaDias} dias de anticipacion`,
      );
    }

    // Una reserva abierta no tiene duracion todavia. `duracionMaximaMinutos`
    // igual sirve: es el tope al que hay que cerrarla. Ver docs/pendientes.md.
    if (!fin) return;
    const minutos = (fin.getTime() - inicio.getTime()) / 60000;
    if (politica.duracionMinimaMinutos && minutos < politica.duracionMinimaMinutos) {
      throw new BadRequestException(`Minimo ${politica.duracionMinimaMinutos} minutos`);
    }
    if (politica.duracionMaximaMinutos && minutos > politica.duracionMaximaMinutos) {
      throw new BadRequestException(`Maximo ${politica.duracionMaximaMinutos} minutos`);
    }
  }

  /**
   * La reserva tiene que caber dentro de una franja de apertura.
   *
   * Solo aplica a los espacios que SON una zona comun: el pool de parqueaderos
   * de visitantes no tiene horario, esta abierto siempre.
   */
  private validarHorario(
    zona: { nombre: string; horarios: { dia: string; apertura: number; cierre: number }[] } | null,
    inicio: Date,
    fin: Date,
  ) {
    if (!zona || zona.horarios.length === 0) return;

    const a = diaYMinutos(inicio);
    const b = diaYMinutos(fin);

    // Una reserva que cruza la medianoche tocaria dos dias y dos franjas. Se
    // valida solo el dia de inicio y se exige que termine ese mismo dia: un
    // evento que pasa de medianoche se parte en dos reservas.
    if (a.dia !== b.dia && b.minutos !== 0) {
      throw new BadRequestException(
        `"${zona.nombre}" tiene horario: la reserva tiene que terminar el mismo dia`,
      );
    }
    const finEnMinutos = a.dia === b.dia ? b.minutos : 1440;

    const cabe = zona.horarios.some(
      (h) => h.dia === a.dia && a.minutos >= h.apertura && finEnMinutos <= h.cierre,
    );
    if (!cabe) {
      const delDia = zona.horarios.filter((h) => h.dia === a.dia);
      const detalle = delDia.length
        ? delDia.map((h) => `${formatearHora(h.apertura)}–${formatearHora(h.cierre)}`).join(', ')
        : 'cerrado ese dia';
      throw new BadRequestException(`"${zona.nombre}" ese dia: ${detalle}`);
    }
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

  /**
   * Filtro de solapamiento con intervalos abiertos.
   *
   * Dos franjas chocan si `A.inicio < B.fin` Y `B.inicio < A.fin`. Un `fin` en
   * null es "hasta siempre", asi que esa mitad de la condicion se cumple sola.
   */
  private solapa(inicio: Date, fin: Date | null) {
    return {
      ...(fin ? { inicio: { lt: fin } } : {}),
      OR: [{ fin: null }, { fin: { gt: inicio } }],
    };
  }

  private normalizarPlaca(placa?: string) {
    return placa ? placa.toUpperCase().replace(/[\s-]/g, '') : null;
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

  /**
   * El cupo concreto tiene que pertenecer al pool del espacio y estar libre.
   *
   * Esto es lo que impide que porteria entregue el V-12 dos veces. Va DENTRO del
   * candado del espacio, por la misma razon que la cuenta de capacidad.
   */
  private async validarCupoLibre(
    tx: Prisma.TransactionClient,
    conjuntoId: string,
    espacio: {
      id: string;
      nombre: string;
      naturalezaParqueadero: NaturalezaParqueadero | null;
      agrupacionId: string | null;
    },
    parqueaderoId: string,
    inicio: Date,
    fin: Date | null,
    ignorarReservaId?: string,
  ) {
    if (!espacio.naturalezaParqueadero) {
      throw new BadRequestException(`"${espacio.nombre}" no es un pool de parqueaderos`);
    }

    const cupo = await tx.parqueadero.findFirst({
      where: { id: parqueaderoId, conjuntoId },
      select: { identificador: true, naturaleza: true, agrupacionId: true, activo: true },
    });

    if (!cupo) throw new NotFoundException('Ese cupo no existe en este conjunto');
    if (!cupo.activo) throw new BadRequestException(`El cupo ${cupo.identificador} esta fuera de servicio`);
    if (cupo.naturaleza !== espacio.naturalezaParqueadero) {
      throw new BadRequestException(
        `El cupo ${cupo.identificador} no es de "${espacio.nombre}": es ${cupo.naturaleza}`,
      );
    }
    if (espacio.agrupacionId && cupo.agrupacionId !== espacio.agrupacionId) {
      throw new BadRequestException(`El cupo ${cupo.identificador} es de otra parte del conjunto`);
    }

    const ocupado = await tx.reserva.findFirst({
      where: {
        parqueaderoId,
        estado: { in: OCUPAN },
        ...(ignorarReservaId ? { NOT: { id: ignorarReservaId } } : {}),
        ...this.solapa(inicio, fin),
      },
      select: { id: true },
    });

    if (ocupado) {
      throw new BadRequestException(`El cupo ${cupo.identificador} ya esta ocupado en esa franja`);
    }
  }

  private async exigirEnCurso(conjuntoId: string, id: string) {
    const reserva = await this.prisma.reserva.findFirst({ where: { id, conjuntoId } });
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (!OCUPAN.includes(reserva.estado)) {
      throw new BadRequestException(`Esa reserva ya esta ${reserva.estado.toLowerCase()}`);
    }
    return reserva;
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
