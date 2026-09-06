/**
 * Los horarios se guardan como minutos desde medianoche para no arrastrar zona
 * horaria (ver el comentario de HorarioZonaComun en el schema). Estos helpers
 * son la unica frontera entre ese entero y como lo ve una persona.
 */

/** 300 -> "05:00" */
export function formatearHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "05:00" -> 300. Lanza si el formato o el rango no son validos. */
export function parsearHora(texto: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texto);
  if (!match) throw new Error(`Hora invalida: "${texto}". Se espera HH:MM.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutos desde medianoche de "ahora" en la zona horaria dada. */
export function minutosDeAhora(zonaHoraria = 'America/Bogota', ahora = new Date()): number {
  const partes = new Intl.DateTimeFormat('es-CO', {
    timeZone: zonaHoraria,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ahora);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return hora * 60 + minuto;
}
