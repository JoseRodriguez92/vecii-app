import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * El arbol de agrupaciones, en un solo lugar.
 *
 * Tres modulos lo recorren —encomiendas para saber a quien le llego el recibo,
 * notificaciones para avisarle a toda una torre, y la propia estructura al
 * validar el padre— y hasta hoy cada uno tenia su version, con tres limites de
 * profundidad distintos. Un arbol, un recorrido.
 */

/**
 * Tres niveles cubren todo lo que existe en Colombia: Etapa -> Torre -> (unidad).
 * Mas profundidad convierte la interfaz en un explorador de archivos.
 */
export const PROFUNDIDAD_MAXIMA = 3;

/**
 * Las agrupaciones dadas mas todas las que estan por encima.
 *
 * Un apartamento de la Torre B de la Etapa 2 tambien recibe lo que llego "para
 * toda la Etapa 2": subir es lo que vuelve visible ese caso.
 */
export async function conAncestros(prisma: PrismaService, ids: string[]): Promise<string[]> {
  const todas = new Set(ids);
  let frontera = [...todas];

  // El tope no es por elegancia: si alguna vez se cuela un ciclo (A padre de B,
  // B padre de A), sin el la API se queda dando vueltas para siempre.
  for (let nivel = 0; nivel < PROFUNDIDAD_MAXIMA && frontera.length > 0; nivel += 1) {
    const padres = await prisma.agrupacion.findMany({
      where: { id: { in: frontera }, padreId: { not: null } },
      select: { padreId: true },
    });
    frontera = padres
      .map((p) => p.padreId)
      .filter((id): id is string => id !== null && !todas.has(id));
    for (const id of frontera) todas.add(id);
  }

  return [...todas];
}

/**
 * Una agrupacion y todo lo que cuelga de ella.
 *
 * Avisarle "a la Etapa 2" tiene que alcanzar a las torres de la Etapa 2 y a sus
 * unidades; si solo se mirara el primer nivel, media etapa no se entera.
 */
export async function conSusHijas(
  prisma: PrismaService,
  conjuntoId: string,
  raizId: string,
): Promise<string[]> {
  const todas = [raizId];
  let frontera = [raizId];

  for (let nivel = 0; nivel < PROFUNDIDAD_MAXIMA && frontera.length > 0; nivel += 1) {
    const hijas = await prisma.agrupacion.findMany({
      where: { conjuntoId, padreId: { in: frontera } },
      select: { id: true },
    });
    frontera = hijas.map((h) => h.id).filter((id) => !todas.includes(id));
    todas.push(...frontera);
  }

  return todas;
}
