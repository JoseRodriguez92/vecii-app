/**
 * Colgar una unidad de otra: cuando se puede y cuando no.
 *
 * Comprar el apto 501 es comprar tres unidades —el apartamento, el parqueadero
 * 34 y el deposito 12—, y por eso una unidad cuelga de otra. Pero el arbol tiene
 * EXACTAMENTE dos niveles: una unidad es principal o es accesoria, nunca las
 * dos. Un parqueadero no tiene deposito propio.
 *
 * La base no puede cuidar esto: cruza filas y ningun CHECK lo ve. El unico que
 * si expresa —`unidad_no_es_accesoria_de_si_misma`— cubre el caso trivial.
 *
 * Funcion pura: recibe los hechos ya leidos y decide. Sin base, para poder
 * probarla.
 */

export interface AlColgar {
  /** La que se va a volver accesoria. */
  identificador: string;
  /** Cuantas unidades cuelgan HOY de ella. Si tiene, ya es principal. */
  accesorias: number;
  /** La que la recibe. `null` = no existe en este conjunto. */
  principal: {
    identificador: string;
    /** Si ella misma ya cuelga de otra. */
    yaEsAccesoria: boolean;
    esLaMisma: boolean;
  } | null;
}

export function problemaAlColgar(c: AlColgar): string | null {
  if (!c.principal) return 'Esa unidad principal no existe en este conjunto';

  if (c.principal.esLaMisma) return 'Una unidad no se vende consigo misma';

  // Hacia abajo: la que recibe no puede estar colgando de otra.
  if (c.principal.yaEsAccesoria) {
    return (
      `La unidad "${c.principal.identificador}" ya es accesoria de otra. Apunta a la principal ` +
      'directamente: las accesorias van en un solo nivel.'
    );
  }

  // Hacia arriba, que es el que faltaba: la que se cuelga no puede tener cosas
  // colgando de ella. Sin esto queda P-34 -> 501 -> 302, y a la hora de facturar
  // el 501 y su parqueadero se quedan sin recibo sin que nadie lo note.
  if (c.accesorias > 0) {
    return (
      `"${c.identificador}" ya es principal: tiene ${c.accesorias} ` +
      `${c.accesorias === 1 ? 'unidad accesoria' : 'unidades accesorias'} colgando. ` +
      'Sueltalas primero, o cuelga esas de la nueva principal.'
    );
  }

  return null;
}
