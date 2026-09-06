import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { diaYMinutos, formatearHora } from '../../common/hora-minutos.js';
import { PERMISOS } from '../../common/permisos.js';
import { rolVigente } from '../../common/rol-vigente.js';
import { EstadoReserva } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CancelarReservaDto, CrearReservaDto, RechazarReservaDto } from './dto/reserva.dto.js';

/** Estados que ocupan cupo. Una cancelada o rechazada libera el espacio. */
const OCUPAN: EstadoReserva[] = [EstadoReserva.SOLICITADA, EstadoReserva.CONFIRMADA];

const HORA = 60 * 60 * 1000;

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    conjuntoId: string,
    f: { espacioId?: string; unidadId?: string; estado?: EstadoReserva; desde?: Date; hasta?: Date },
  ) {
    return this.prisma.reserva.findMany({
      where: {
        conjuntoId,
        ...(f.espacioId ? { espacioId: f.espacioId } : {}),
        ...(f.unidadId ? { unidadId: f.unidadId } : {}),
        ...(f.estado ? { estado: f.estado } : {}),
        ...(f.hasta ? { inicio: { lt: f.hasta } } : {}),
        ...(f.desde ? { fin: { gt: f.desde } } : {}),
      },
      orderBy: { inicio: 'asc' },
      include: {
        espacio: { select: { id: true, nombre: true, capacidad: true } },
        unidad: { select: { id: true, identificador: true } },
        solicitadaPor: { select: { id: true, nombres: true, apellidos: true } },
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
   */
  async crear(activo: ConjuntoActivo, usuarioId: string, dto: CrearReservaDto) {
    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);
    if (fin <= inicio) throw new BadRequestException('El fin va despues del inicio');

    const espacio = await this.prisma.espacioReservable.findFirst({
      where: { id: dto.espacioId, conjuntoId: activo.conjuntoId },
      include: { politica: true, zonaComun: { include: { horarios: true } } },
    });
    if (!espacio) throw new NotFoundException('Ese espacio reservable no existe en este conjunto');
    if (!espacio.activo) throw new BadRequestException(`"${espacio.nombre}" esta fuera de servicio`);

    const relacion = await this.exigirAlcance(activo, usuarioId, dto.unidadId);
    const politica = espacio.politica;

    if (politica?.soloPropietarios && relacion !== 'PROPIETARIO' && !this.esAdmin(activo)) {
      throw new ForbiddenException(`"${espacio.nombre}" solo lo pueden reservar los propietarios`);
    }

    this.validarPolitica(espacio.nombre, politica, inicio, fin);
    this.validarHorario(espacio.zonaComun, inicio, fin);
    await this.validarCuposDeLaUnidad(politica, dto.unidadId, dto.espacioId, inicio);

    const estado = politica?.requiereAprobacion
      ? EstadoReserva.SOLICITADA
      : EstadoReserva.CONFIRMADA;

    return this.prisma.$transaction(async (tx) => {
      // Sin este candado, dos residentes que aparten el ultimo cupo en el mismo
      // segundo cuentan los dos "quedan 1" y los dos crean su fila. Contar y
      // luego insertar NO es atomico por si solo.
      //
      // Es un lock de TRANSACCION: se suelta solo al terminar, asi que funciona
      // igual detras del pooler de Supabase. Serializa unicamente las reservas
      // del mismo espacio.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dto.espacioId}::text, 0::bigint))`;

      const solapadas = await tx.reserva.count({
        where: {
          espacioId: dto.espacioId,
          estado: { in: OCUPAN },
          inicio: { lt: fin },
          fin: { gt: inicio },
        },
      });
      if (solapadas >= espacio.capacidad) {
        throw new BadRequestException(
          espacio.capacidad === 1
            ? `"${espacio.nombre}" ya esta reservado en esa franja`
            : `No quedan cupos en "${espacio.nombre}" para esa franja (${espacio.capacidad} en total)`,
        );
      }

      return tx.reserva.create({
        data: {
          conjuntoId: activo.conjuntoId,
          espacioId: dto.espacioId,
          unidadId: dto.unidadId,
          solicitadaPorId: usuarioId,
          inicio,
          fin,
          estado,
          observacion: dto.observacion ?? null,
        },
      });
    });
  }

  async aprobar(conjuntoId: string, usuarioId: string, id: string) {
    const reserva = await this.exigirEnCurso(conjuntoId, id);
    if (reserva.estado !== EstadoReserva.SOLICITADA) {
      throw new BadRequestException('Esa reserva no esta esperando aprobacion');
    }
    return this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CONFIRMADA,
        aprobadaPorId: usuarioId,
        aprobadaEn: new Date(),
      },
    });
  }

  async rechazar(conjuntoId: string, usuarioId: string, id: string, dto: RechazarReservaDto) {
    const reserva = await this.exigirEnCurso(conjuntoId, id);
    if (reserva.estado !== EstadoReserva.SOLICITADA) {
      throw new BadRequestException('Esa reserva no esta esperando aprobacion');
    }
    return this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CANCELADA,
        motivoRechazo: dto.motivo,
        aprobadaPorId: usuarioId,
        aprobadaEn: new Date(),
      },
    });
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

    return this.prisma.reserva.update({
      where: { id },
      data: {
        estado: EstadoReserva.CANCELADA,
        ...(dto.motivo ? { motivoRechazo: dto.motivo } : {}),
      },
    });
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
    fin: Date,
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
