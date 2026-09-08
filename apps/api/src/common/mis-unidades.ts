import type { PrismaService } from '../prisma/prisma.service.js';
import { rolVigente } from './rol-vigente.js';

/**
 * Las unidades donde una persona vive o de las que es duena, hoy, en un conjunto.
 *
 * Vive en `common` porque la preguntan tres modulos —porteria para los
 * invitados y los vehiculos, reservas para saber si puede apartar, y el detalle
 * de cualquier fila para saber si es suya— y tiene que ser la MISMA respuesta.
 * Estuvo escrita dos veces, y dos definiciones de "mis unidades" es como se
 * abre un hueco: se corrige una y la otra sigue mal.
 *
 * Vivir, no ser dueno: un arrendatario tiene sus unidades igual que un
 * propietario. Lo que los distingue es la `relacion`, no esta lista.
 */
export async function misUnidades(
  prisma: PrismaService,
  conjuntoId: string,
  usuarioId: string,
): Promise<string[]> {
  const ocupaciones = await prisma.usuarioUnidad.findMany({
    where: { usuarioId, unidad: { conjuntoId }, ...rolVigente() },
    select: { unidadId: true },
  });
  return ocupaciones.map((o) => o.unidadId);
}
