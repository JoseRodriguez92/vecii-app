import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoReserva } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AsignarCupoDto, RegistrarSalidaDto } from './dto/reserva.dto.js';
import { exigirEnCurso, validarCupoLibre } from './ocupacion.js';
import { normalizarPlaca } from './reglas-reserva.js';

/**
 * Lo que hace porteria cuando el carro ya esta en la puerta.
 *
 * Esta aparte de `ReservasService` porque es otro momento y otra persona: el
 * residente aparto "un cupo del pool" hace tres dias; aca se decide cual le
 * toco y a que hora se fue.
 */
@Injectable()
export class CuposService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le asigna el cupo concreto cuando llega el carro. La reserva apartaba "un
   * espacio del pool"; esto dice cual le toco.
   */
  async asignarCupo(conjuntoId: string, id: string, dto: AsignarCupoDto) {
    const reserva = await exigirEnCurso(this.prisma, conjuntoId, id);
    const espacio = await this.prisma.espacioReservable.findFirstOrThrow({
      where: { id: reserva.espacioId },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reserva.espacioId}::text, 0::bigint))`;
      await validarCupoLibre(
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
          ...(dto.placa ? { placa: normalizarPlaca(dto.placa) } : {}),
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
    const reserva = await exigirEnCurso(this.prisma, conjuntoId, id);
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
}
