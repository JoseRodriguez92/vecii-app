import type { Prisma } from '../../generated/prisma/client.js';
import { CONCEPTOS_DEL_SISTEMA } from '../finanzas/conceptos-del-sistema.js';

/**
 * Lo que todo conjunto necesita tener el dia que nace.
 *
 * Va aparte de `ConjuntosService` porque son dos preguntas distintas: alla se
 * decide QUE es un conjunto y quien lo administra; aqui, con que arranca. La
 * lista va a crecer —hoy son los conceptos de cobro, manana quiza los cargos
 * propios (ver ADR-0007 y pendientes.md)— y eso no tiene por que engordar el
 * servicio.
 *
 * Recibe el `tx` y no abre el suyo: corre DENTRO de la transaccion que crea el
 * conjunto. Si la siembra falla, el conjunto tampoco se crea — un conjunto a
 * medio sembrar es peor que ninguno, porque nadie se entera hasta que la
 * facturacion no encuentra donde poner la cuota.
 */
export async function sembrarConjunto(tx: Prisma.TransactionClient, conjuntoId: string) {
  await tx.conceptoCobro.createMany({
    data: CONCEPTOS_DEL_SISTEMA.map((c) => ({ ...c, conjuntoId })),
  });
}
