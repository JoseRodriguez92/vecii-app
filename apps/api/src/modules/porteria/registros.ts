import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConjuntoActivo } from '../../auth/conjunto-activo.js';
import { rolVigente } from '../../common/rol-vigente.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Lo que comparten los tres registros de porteria —invitados, vehiculos y
 * bicicletas—, que son la misma forma: algo que pertenece a una unidad, que
 * estuvo vigente entre dos fechas y que porteria consulta en la puerta.
 *
 * Son tres preguntas: quien puede tocar esa unidad, que sigue vigente hoy, y
 * con que contexto se lee la fila.
 *
 * El alcance estaba escrito dentro de `invitados` y lo iban a copiar dos
 * servicios mas. Tres copias de una regla de autorizacion es como se abre un
 * hueco: se corrige una y las otras dos siguen abiertas.
 */

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

/**
 * El propietario del carro o de la bicicleta tiene que estar registrado aqui.
 *
 * Es opcional a proposito: el carro puede ser del papa que no usa la app. Pero
 * si viene, no puede ser cualquier id: seria un dueno de otro conjunto.
 */
export async function exigirPropietario(
  prisma: PrismaService,
  conjuntoId: string,
  propietarioId?: string | null,
): Promise<void> {
  if (!propietarioId) return;
  const esta = await prisma.usuarioConjunto.findFirst({
    where: { usuarioId: propietarioId, conjuntoId, activo: true },
    select: { id: true },
  });
  if (!esta) throw new BadRequestException('Esa persona no esta registrada en este conjunto');
}

/** De quien es y donde vive: lo que porteria necesita ver junto a la fila. */
export const CON_CONTEXTO = {
  unidad: { select: { id: true, identificador: true } },
  propietario: { select: { id: true, nombres: true, apellidos: true } },
} as const;
