import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { rolVigente } from '../../common/rol-vigente.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * El alcance de FILA de porteria, en un solo lugar.
 *
 * El guard razona a nivel de CONJUNTO: sabe si alguien tiene un permiso aqui
 * adentro, no si esa unidad concreta es suya. Eso es mas fino y tiene que
 * resolverlo el servicio.
 *
 * Estaba escrito dentro de `invitados` y lo iban a copiar dos servicios mas.
 * Tres copias de una regla de autorizacion es como se abre un hueco: se corrige
 * una y las otras dos siguen abiertas.
 */

/** Las unidades donde vive quien pregunta, en este conjunto. */
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

/**
 * Deja pasar si tiene el permiso amplio, o si vive en esa unidad.
 *
 * Vivir, no ser dueno. Los amigos y el carro son de quien vive en la unidad, no
 * de quien firma la escritura: un arrendatario invita a su mama y registra su
 * carro igual que un propietario. (Registrar USUARIOS si exige ser propietario,
 * y por eso esa regla vive aparte.)
 */
export async function exigirAlcance(
  prisma: PrismaService,
  activo: ConjuntoActivo,
  autorId: string,
  unidadId: string,
  permisoAmplio: string,
  queNoPuede: string,
): Promise<void> {
  const unidad = await prisma.unidad.findFirst({
    where: { id: unidadId, conjuntoId: activo.conjuntoId },
    select: { id: true },
  });
  if (!unidad) throw new NotFoundException('Esa unidad no existe en este conjunto');

  if (activo.permisos.has(permisoAmplio)) return;

  const vive = await prisma.usuarioUnidad.findFirst({
    where: { usuarioId: autorId, unidadId, ...rolVigente() },
    select: { id: true },
  });
  if (!vive) throw new ForbiddenException(queNoPuede);
}

/** Vigente = ya empezo y no ha terminado. `hasta` null es permanente. */
export function vigentes() {
  const ahora = new Date();
  return { desde: { lte: ahora }, OR: [{ hasta: null }, { hasta: { gt: ahora } }] };
}

/** La placa como la teclea porteria: en mayusculas y sin separadores. */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]/g, '');
}
