/**
 * Las reglas de los parqueaderos que ninguna base de datos puede cuidar.
 *
 * Estan aqui, en funciones puras, y no dentro del servicio, por dos razones.
 * La primera es que se pueden probar sin base, sin mocks y sin levantar Nest:
 * son 20 combinaciones y la prueba las recorre todas. La segunda es que asi la
 * regla se lee de corrido, sin `await` ni `prisma` en el medio.
 *
 * El fondo del asunto es juridico y no tecnico. Los tres tipos de cupo que
 * existen en Colombia son cosas legalmente distintas, y de ahi sale todo:
 *
 *   PRIVADO        es TUYO. Tiene matricula y coeficiente, y existe ademas
 *                  como `Unidad`. Lo compraste con el apartamento.
 *   USO_EXCLUSIVO  es un bien COMUN que te asignaron en exclusiva. No es tuyo,
 *                  no tiene matricula, y la asamblea puede reasignarlo.
 *   ROTATIVO       es un bien comun que se reparte por periodo, casi siempre
 *                  por sorteo anual.
 *   VISITANTES     es un bien comun de uso general. No se asigna a nadie.
 */
import {
  NaturalezaParqueadero as Naturaleza,
  OrigenAsignacion as Origen,
} from '../../generated/prisma/enums.js';

/** Que origen de derecho puede tener una asignacion, segun que sea el cupo. */
export const ORIGENES_VALIDOS: Record<Naturaleza, Origen[]> = {
  [Naturaleza.PRIVADO]: [Origen.PROPIEDAD, Origen.PRESTAMO, Origen.ARRIENDO],
  [Naturaleza.USO_EXCLUSIVO]: [Origen.REGLAMENTO, Origen.PRESTAMO],
  [Naturaleza.ROTATIVO]: [Origen.SORTEO, Origen.PRESTAMO],
  /// Vacio a proposito, y no es un olvido: un cupo de visitantes NO se le asigna
  /// a nadie. Se usa por turnos a traves de su espacio reservable.
  [Naturaleza.VISITANTES]: [],
};

/**
 * Por que ESA combinacion no va. Devuelve null si es valida.
 *
 * El mensaje explica el motivo en vez de decir "origen invalido": quien lo lee
 * es un administrador cargando el inventario de su conjunto, no un programador.
 */
const MOTIVOS: Partial<Record<string, string>> = {
  [`${Naturaleza.PRIVADO}:${Origen.SORTEO}`]:
    'Un cupo privado no se sortea: tiene matricula y coeficiente, ya tiene dueno.',
  [`${Naturaleza.PRIVADO}:${Origen.REGLAMENTO}`]:
    'El reglamento no reparte lo que ya es de alguien. Un cupo privado se compro.',
  [`${Naturaleza.USO_EXCLUSIVO}:${Origen.PROPIEDAD}`]:
    'Un cupo de uso exclusivo es un bien comun: esta asignado, no es de nadie. Si de verdad ' +
    'tiene matricula y coeficiente, entonces es PRIVADO.',
  [`${Naturaleza.USO_EXCLUSIVO}:${Origen.SORTEO}`]:
    'Si se sortea cada periodo no es de uso exclusivo, es ROTATIVO.',
  [`${Naturaleza.USO_EXCLUSIVO}:${Origen.ARRIENDO}`]:
    'No se arrienda un bien comun que solo esta asignado. Prestarlo si.',
  [`${Naturaleza.ROTATIVO}:${Origen.PROPIEDAD}`]:
    'Un cupo rotativo es un bien comun que se reparte por periodo. Nadie es dueno.',
  [`${Naturaleza.ROTATIVO}:${Origen.REGLAMENTO}`]:
    'Si el reglamento lo asigna fijo, entonces no rota: es USO_EXCLUSIVO.',
  [`${Naturaleza.ROTATIVO}:${Origen.ARRIENDO}`]:
    'No se arrienda un cupo que le toco a uno en el sorteo. Prestarlo si.',
};

const SIN_ASIGNACION =
  'Un cupo de visitantes no se le asigna a nadie: se usa por turnos a traves de su espacio ' +
  'reservable. Lo que cambia ahi es que carro esta parqueado en este momento, y eso es una ' +
  'reserva, no una asignacion.';

export function razonDeRechazo(naturaleza: Naturaleza, origen: Origen): string | null {
  if (ORIGENES_VALIDOS[naturaleza].includes(origen)) return null;
  if (naturaleza === Naturaleza.VISITANTES) return SIN_ASIGNACION;
  return (
    MOTIVOS[`${naturaleza}:${origen}`] ??
    `Un cupo ${naturaleza} no admite el origen ${origen}.`
  );
}

/** Atajo legible: `if (!sePuedeAsignar(...))`. */
export const sePuedeAsignar = (naturaleza: Naturaleza, origen: Origen): boolean =>
  razonDeRechazo(naturaleza, origen) === null;

/**
 * `Parqueadero.unidadId` no significa "quien lo usa" — eso es una asignacion.
 * Significa "este cupo ES esa unidad", y solo un PRIVADO lo es, porque solo el
 * tiene matricula y coeficiente propios.
 *
 * Es el campo que mas se presta a confusion del modelo entero: el mismo nombre
 * apunta a relaciones invertidas en `parqueaderos` y en
 * `asignaciones_parqueadero`. Ver docs/pendientes.md.
 */
export function problemaDeUnidad(naturaleza: Naturaleza, unidadId?: string | null): string | null {
  if (naturaleza === Naturaleza.PRIVADO && !unidadId) {
    return (
      'Un cupo PRIVADO es una unidad: tiene matricula y coeficiente propios. Falta decir cual ' +
      '(`unidadId`), o el cupo queda a medio crear y algun dia va a faltar en un recibo.'
    );
  }
  if (naturaleza !== Naturaleza.PRIVADO && unidadId) {
    return (
      `Un cupo ${naturaleza} es un bien comun: no ES ninguna unidad. Para decir QUIEN lo usa ` +
      'va una asignacion, no este campo.'
    );
  }
  return null;
}
