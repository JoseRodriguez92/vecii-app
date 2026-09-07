/**
 * Las reglas de una reserva, probadas sin base de datos.
 *
 * Estas pruebas no existian —y no PODIAN existir— mientras estas reglas vivian
 * dentro de `ReservasService`: para ejercitar "una reserva que cruza la
 * medianoche se rechaza" habia que levantar Nest y hablarle a Postgres. Sacarlas
 * a `reglas-reserva.ts` fue lo que las hizo posibles.
 *
 * Las fechas van en UTC y se leen en America/Bogota, que es UTC-5 todo el ano
 * (Colombia no cambia la hora). Asi que 13:00Z son las 8 de la manana aca.
 * El 12 de septiembre de 2026 es sabado.
 */
import { describe, expect, it } from 'vitest';
import { normalizarPlaca, solapa, validarHorario, validarPolitica } from './reglas-reserva.js';

/** 8:00 a. m. del sabado, en Bogota. */
const SABADO_8AM = new Date('2026-09-12T13:00:00.000Z');
const SABADO_3PM = new Date('2026-09-12T20:00:00.000Z');
const SABADO_10PM = new Date('2026-09-13T03:00:00.000Z');
const SABADO_11PM = new Date('2026-09-13T04:00:00.000Z');
/** Medianoche exacta: ya es domingo, minuto 0. */
const DOMINGO_MEDIANOCHE = new Date('2026-09-13T05:00:00.000Z');
const DOMINGO_1AM = new Date('2026-09-13T06:00:00.000Z');

const salon = (horarios: { dia: string; apertura: number; cierre: number }[]) => ({
  nombre: 'Salon Social',
  horarios,
});
/** De 8:00 a 22:00 los sabados. */
const DE_8_A_22 = [{ dia: 'SABADO', apertura: 480, cierre: 1320 }];

describe('la reserva tiene que caber en el horario', () => {
  it('un espacio sin zona comun no tiene horario: el pool de visitantes esta abierto siempre', () => {
    expect(() => validarHorario(null, SABADO_8AM, SABADO_10PM)).not.toThrow();
  });

  it('una zona sin franjas cargadas no restringe nada', () => {
    expect(() => validarHorario(salon([]), SABADO_8AM, SABADO_10PM)).not.toThrow();
  });

  it('acepta la que cabe dentro de la franja', () => {
    expect(() => validarHorario(salon(DE_8_A_22), SABADO_3PM, SABADO_10PM)).not.toThrow();
  });

  it('rechaza la que se pasa de la hora de cierre', () => {
    expect(() => validarHorario(salon(DE_8_A_22), SABADO_3PM, SABADO_11PM)).toThrow(/08:00–22:00/);
  });

  it('rechaza el dia que la zona no abre, y lo dice', () => {
    expect(() => validarHorario(salon(DE_8_A_22), DOMINGO_1AM, DOMINGO_1AM)).toThrow(
      /cerrado ese dia/,
    );
  });

  it('rechaza la que cruza la medianoche: eso son dos reservas', () => {
    expect(() => validarHorario(salon(DE_8_A_22), SABADO_10PM, DOMINGO_1AM)).toThrow(
      /terminar el mismo dia/,
    );
  });

  it('pero terminar EXACTAMENTE a medianoche si vale', () => {
    const hasta_medianoche = [{ dia: 'SABADO', apertura: 480, cierre: 1440 }];
    expect(() =>
      validarHorario(salon(hasta_medianoche), SABADO_3PM, DOMINGO_MEDIANOCHE),
    ).not.toThrow();
  });

  it('aguanta un horario partido: abre, cierra al mediodia, reabre', () => {
    const partido = [
      { dia: 'SABADO', apertura: 480, cierre: 720 }, //  8:00–12:00
      { dia: 'SABADO', apertura: 840, cierre: 1200 }, // 14:00–20:00
    ];
    // Las 3 p. m. caen limpias en la segunda franja.
    expect(() => validarHorario(salon(partido), SABADO_3PM, SABADO_3PM)).not.toThrow();
    // De 8 a 22 se monta sobre el hueco del mediodia: ninguna franja la contiene.
    expect(() => validarHorario(salon(partido), SABADO_8AM, SABADO_10PM)).toThrow(
      /08:00–12:00, 14:00–20:00/,
    );
  });
});

describe('las reglas que pone la politica del espacio', () => {
  const enHoras = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
  const vacia = {
    anticipacionMinimaHoras: null,
    anticipacionMaximaDias: null,
    duracionMinimaMinutos: null,
    duracionMaximaMinutos: null,
  };

  it('no se reserva hacia atras, ni siquiera sin politica', () => {
    expect(() => validarPolitica('Salon', null, enHoras(-1), null)).toThrow(/hacia atras/);
  });

  it('sin politica, lo unico que se exige es que sea a futuro', () => {
    expect(() => validarPolitica('Salon', null, enHoras(1), enHoras(2))).not.toThrow();
  });

  it('exige la anticipacion minima', () => {
    const p = { ...vacia, anticipacionMinimaHoras: 24 };
    expect(() => validarPolitica('Salon', p, enHoras(2), enHoras(4))).toThrow(/24 horas/);
    expect(() => validarPolitica('Salon', p, enHoras(30), enHoras(32))).not.toThrow();
  });

  it('exige la anticipacion maxima: nadie aparta todos los sabados del ano en enero', () => {
    const p = { ...vacia, anticipacionMaximaDias: 30 };
    expect(() => validarPolitica('Salon', p, enHoras(24 * 40), null)).toThrow(/30 dias/);
  });

  it('exige la duracion minima y la maxima', () => {
    const p = { ...vacia, duracionMinimaMinutos: 60, duracionMaximaMinutos: 240 };
    const inicio = enHoras(5);
    expect(() => validarPolitica('Salon', p, inicio, new Date(inicio.getTime() + 30 * 60000))).toThrow(
      /Minimo 60/,
    );
    expect(() =>
      validarPolitica('Salon', p, inicio, new Date(inicio.getTime() + 300 * 60000)),
    ).toThrow(/Maximo 240/);
    expect(() =>
      validarPolitica('Salon', p, inicio, new Date(inicio.getTime() + 120 * 60000)),
    ).not.toThrow();
  });

  it('una reserva ABIERTA no tiene duracion todavia, asi que no se le valida', () => {
    const p = { ...vacia, duracionMinimaMinutos: 60, duracionMaximaMinutos: 240 };
    expect(() => validarPolitica('Parqueadero', p, enHoras(1), null)).not.toThrow();
  });
});

describe('el filtro de solapamiento', () => {
  const inicio = new Date('2026-09-12T13:00:00.000Z');
  const fin = new Date('2026-09-12T20:00:00.000Z');

  it('con fin acota por los dos lados', () => {
    expect(solapa(inicio, fin)).toEqual({
      inicio: { lt: fin },
      OR: [{ fin: null }, { fin: { gt: inicio } }],
    });
  });

  it('sin fin, "hasta siempre": esa mitad de la condicion se cumple sola', () => {
    expect(solapa(inicio, null)).toEqual({ OR: [{ fin: null }, { fin: { gt: inicio } }] });
  });
});

describe('la placa', () => {
  it('se guarda como la teclea porteria: mayusculas y sin separadores', () => {
    expect(normalizarPlaca('abc 123')).toBe('ABC123');
    expect(normalizarPlaca('abc-123')).toBe('ABC123');
    expect(normalizarPlaca('ABC123')).toBe('ABC123');
  });

  it('sin placa es null, no cadena vacia: no vino el dato', () => {
    expect(normalizarPlaca(undefined)).toBeNull();
    expect(normalizarPlaca('')).toBeNull();
  });
});
