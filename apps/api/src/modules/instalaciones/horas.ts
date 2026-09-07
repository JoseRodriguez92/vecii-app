/**
 * Las horas de una zona comun se guardan como MINUTOS DESDE MEDIANOCHE, no como
 * `time`. La razon esta en el schema: un `time` de Postgres llega a JavaScript
 * como un Date del 1970 en UTC y al formatearlo en America/Bogota se corre cinco
 * horas. Un entero no tiene zona horaria.
 *
 * El costo de esa decision es que `1320` no se lee. Asi que la respuesta lleva
 * las dos formas: el entero, que es el dato, y el texto, que se DERIVA de el.
 * No se guarda: si se guardara, algun dia dirian cosas distintas.
 */

/** 480 -> "08:00". 1440 -> "24:00", la medianoche del dia siguiente. */
export function aHora(minutos: number): string {
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0');
  const mm = String(minutos % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Le agrega a una franja su version legible. */
export function conHoras<T extends { apertura: number; cierre: number }>(franja: T) {
  return { ...franja, aperturaHora: aHora(franja.apertura), cierreHora: aHora(franja.cierre) };
}
