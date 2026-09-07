import { BadRequestException } from '@nestjs/common';
import { diaYMinutos, formatearHora } from '../../common/hora-minutos.js';

/**
 * Las reglas de una reserva que NO necesitan la base de datos.
 *
 * Estaban dentro de `ReservasService`, mezcladas con las que si consultan
 * —cuantas reservas lleva esa unidad este mes, si el cupo esta libre— y por eso
 * no habia forma de probarlas: para ejercitar "una reserva que cruza la
 * medianoche se rechaza" habia que levantar Nest y hablarle a Postgres.
 *
 * Aqui son funciones sueltas. Se les pasa la politica o el horario ya leidos, y
 * deciden. Su prueba corre en milisegundos y no toca nada.
 *
 * (Siguen lanzando excepciones de Nest en vez de devolver el motivo, como si
 * hace `reglas-parqueadero.ts`. Convertirlas es una reescritura y esto fue una
 * mudanza; queda anotado.)
 */

/** Un milisegundo por hora, para no repetir el 3600000. */
export const HORA = 60 * 60 * 1000;

export function validarPolitica(
  nombre: string,
  politica: { anticipacionMinimaHoras: number | null; anticipacionMaximaDias: number | null; duracionMinimaMinutos: number | null; duracionMaximaMinutos: number | null } | null,
  inicio: Date,
  fin: Date | null,
) {
  if (inicio.getTime() < Date.now()) {
    throw new BadRequestException('No se puede reservar hacia atras');
  }
  if (!politica) return;

  const horasDeAnticipacion = (inicio.getTime() - Date.now()) / HORA;
  if (politica.anticipacionMinimaHoras && horasDeAnticipacion < politica.anticipacionMinimaHoras) {
    throw new BadRequestException(
      `"${nombre}" se reserva con al menos ${politica.anticipacionMinimaHoras} horas de anticipacion`,
    );
  }
  if (politica.anticipacionMaximaDias && horasDeAnticipacion > politica.anticipacionMaximaDias * 24) {
    throw new BadRequestException(
      `"${nombre}" no se puede reservar con mas de ${politica.anticipacionMaximaDias} dias de anticipacion`,
    );
  }

  // Una reserva abierta no tiene duracion todavia. `duracionMaximaMinutos`
  // igual sirve: es el tope al que hay que cerrarla. Ver docs/pendientes.md.
  if (!fin) return;
  const minutos = (fin.getTime() - inicio.getTime()) / 60000;
  if (politica.duracionMinimaMinutos && minutos < politica.duracionMinimaMinutos) {
    throw new BadRequestException(`Minimo ${politica.duracionMinimaMinutos} minutos`);
  }
  if (politica.duracionMaximaMinutos && minutos > politica.duracionMaximaMinutos) {
    throw new BadRequestException(`Maximo ${politica.duracionMaximaMinutos} minutos`);
  }
}

/**
 * La reserva tiene que caber dentro de una franja de apertura.
 *
 * Solo aplica a los espacios que SON una zona comun: el pool de parqueaderos
 * de visitantes no tiene horario, esta abierto siempre.
 */
export function validarHorario(
  zona: { nombre: string; horarios: { dia: string; apertura: number; cierre: number }[] } | null,
  inicio: Date,
  fin: Date,
) {
  if (!zona || zona.horarios.length === 0) return;

  const a = diaYMinutos(inicio);
  const b = diaYMinutos(fin);

  // Una reserva que cruza la medianoche tocaria dos dias y dos franjas. Se
  // valida solo el dia de inicio y se exige que termine ese mismo dia: un
  // evento que pasa de medianoche se parte en dos reservas.
  if (a.dia !== b.dia && b.minutos !== 0) {
    throw new BadRequestException(
      `"${zona.nombre}" tiene horario: la reserva tiene que terminar el mismo dia`,
    );
  }
  const finEnMinutos = a.dia === b.dia ? b.minutos : 1440;

  const cabe = zona.horarios.some(
    (h) => h.dia === a.dia && a.minutos >= h.apertura && finEnMinutos <= h.cierre,
  );
  if (!cabe) {
    const delDia = zona.horarios.filter((h) => h.dia === a.dia);
    const detalle = delDia.length
      ? delDia.map((h) => `${formatearHora(h.apertura)}–${formatearHora(h.cierre)}`).join(', ')
      : 'cerrado ese dia';
    throw new BadRequestException(`"${zona.nombre}" ese dia: ${detalle}`);
  }
}

/**
 * Filtro de solapamiento con intervalos abiertos.
 *
 * Dos franjas chocan si `A.inicio < B.fin` Y `B.inicio < A.fin`. Un `fin` en
 * null es "hasta siempre", asi que esa mitad de la condicion se cumple sola.
 */
export function solapa(inicio: Date, fin: Date | null) {
  return {
    ...(fin ? { inicio: { lt: fin } } : {}),
    OR: [{ fin: null }, { fin: { gt: inicio } }],
  };
}
