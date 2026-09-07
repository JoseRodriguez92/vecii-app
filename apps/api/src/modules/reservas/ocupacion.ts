import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { EstadoReserva, type NaturalezaParqueadero } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { solapa } from './reglas-reserva.js';

/**
 * "¿Esto ya esta tomado?" — lo que comparten reservar y asignar el cupo.
 *
 * Son funciones sueltas y no metodos de un servicio porque las llaman dos
 * servicios distintos, y porque `validarCupoLibre` corre DENTRO de una
 * transaccion ajena: recibe el `tx` en vez de abrir el suyo.
 */

/** Estados que ocupan cupo. Una cancelada o rechazada libera el espacio. */
export const OCUPAN: EstadoReserva[] = [EstadoReserva.SOLICITADA, EstadoReserva.CONFIRMADA];

/** Trae la reserva y exige que todavia este ocupando: sobre una cancelada no se opera. */
export async function exigirEnCurso(prisma: PrismaService, conjuntoId: string, id: string) {
  const reserva = await prisma.reserva.findFirst({ where: { id, conjuntoId } });
  if (!reserva) throw new NotFoundException('Reserva no encontrada');
  if (!OCUPAN.includes(reserva.estado)) {
    throw new BadRequestException(`Esa reserva ya esta ${reserva.estado.toLowerCase()}`);
  }
  return reserva;
}

/** Lo minimo del espacio que hace falta para juzgar si un cupo le sirve. */
export type PoolDeCupos = {
  id: string;
  nombre: string;
  naturalezaParqueadero: NaturalezaParqueadero | null;
  agrupacionId: string | null;
};

/**
 * El cupo concreto tiene que pertenecer al pool del espacio y estar libre.
 *
 * Esto es lo que impide que porteria entregue el V-12 dos veces. Va DENTRO del
 * candado del espacio, por la misma razon que la cuenta de capacidad.
 */
export async function validarCupoLibre(
  tx: Prisma.TransactionClient,
  conjuntoId: string,
  espacio: PoolDeCupos,
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
  if (!cupo.activo) {
    throw new BadRequestException(`El cupo ${cupo.identificador} esta fuera de servicio`);
  }
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
      ...solapa(inicio, fin),
    },
    select: { id: true },
  });

  if (ocupado) {
    throw new BadRequestException(`El cupo ${cupo.identificador} ya esta ocupado en esa franja`);
  }
}
