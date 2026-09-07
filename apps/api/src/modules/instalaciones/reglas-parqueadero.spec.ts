/**
 * Las primeras pruebas del repo, y estan aqui a proposito.
 *
 * No prueban que Prisma guarde ni que Nest enrute — eso lo prueba el framework.
 * Prueban la unica cosa que ninguna restriccion de base puede cuidar: que el
 * derecho a usar un cupo case con la naturaleza juridica del cupo. Son 20
 * combinaciones, se recorren todas, y corren en milisegundos porque no tocan
 * nada.
 */
import { describe, expect, it } from 'vitest';
import {
  NaturalezaParqueadero as Naturaleza,
  OrigenAsignacion as Origen,
} from '../../generated/prisma/enums.js';
import { ORIGENES_VALIDOS, problemaDeUnidad, razonDeRechazo } from './reglas-parqueadero.js';

const NATURALEZAS = Object.values(Naturaleza);
const ORIGENES = Object.values(Origen);

describe('que origen puede tener una asignacion segun el cupo', () => {
  /** La matriz, escrita a mano. Si el codigo cambia, esto tiene que doler. */
  const ESPERADO: Record<string, Origen[]> = {
    [Naturaleza.PRIVADO]: [Origen.PROPIEDAD, Origen.PRESTAMO, Origen.ARRIENDO],
    [Naturaleza.USO_EXCLUSIVO]: [Origen.REGLAMENTO, Origen.PRESTAMO],
    [Naturaleza.ROTATIVO]: [Origen.SORTEO, Origen.PRESTAMO],
    [Naturaleza.VISITANTES]: [],
  };

  it('cubre las cuatro naturalezas, sin olvidar ninguna', () => {
    expect(Object.keys(ORIGENES_VALIDOS).sort()).toEqual([...NATURALEZAS].sort());
  });

  // 4 naturalezas x 5 origenes = las 20 celdas de la matriz.
  for (const naturaleza of NATURALEZAS) {
    for (const origen of ORIGENES) {
      const deberiaPasar = ESPERADO[naturaleza].includes(origen);
      it(`${naturaleza} + ${origen} -> ${deberiaPasar ? 'se acepta' : 'se rechaza'}`, () => {
        const razon = razonDeRechazo(naturaleza, origen);
        if (deberiaPasar) expect(razon).toBeNull();
        else expect(razon).toBeTypeOf('string');
      });
    }
  }

  it('un cupo de visitantes no se le asigna a nadie, con ningun origen', () => {
    for (const origen of ORIGENES) {
      expect(razonDeRechazo(Naturaleza.VISITANTES, origen)).toContain('por turnos');
    }
  });

  it('el prestamo vale para todo lo que se puede asignar', () => {
    for (const naturaleza of NATURALEZAS) {
      if (naturaleza === Naturaleza.VISITANTES) continue;
      expect(razonDeRechazo(naturaleza, Origen.PRESTAMO)).toBeNull();
    }
  });

  it('solo el privado admite PROPIEDAD, porque es el unico que se compra', () => {
    expect(razonDeRechazo(Naturaleza.PRIVADO, Origen.PROPIEDAD)).toBeNull();
    for (const naturaleza of NATURALEZAS) {
      if (naturaleza === Naturaleza.PRIVADO) continue;
      expect(razonDeRechazo(naturaleza, Origen.PROPIEDAD)).toBeTypeOf('string');
    }
  });

  it('explica el motivo en vez de decir "origen invalido"', () => {
    expect(razonDeRechazo(Naturaleza.PRIVADO, Origen.SORTEO)).toContain('coeficiente');
    expect(razonDeRechazo(Naturaleza.ROTATIVO, Origen.REGLAMENTO)).toContain('USO_EXCLUSIVO');
  });
});

describe('cuando el cupo ES una unidad', () => {
  it('un privado sin unidad esta a medio crear', () => {
    expect(problemaDeUnidad(Naturaleza.PRIVADO, null)).toContain('unidadId');
    expect(problemaDeUnidad(Naturaleza.PRIVADO, undefined)).toBeTypeOf('string');
  });

  it('un privado con unidad esta completo', () => {
    expect(problemaDeUnidad(Naturaleza.PRIVADO, 'una-unidad')).toBeNull();
  });

  it('un bien comun no ES ninguna unidad', () => {
    for (const naturaleza of NATURALEZAS) {
      if (naturaleza === Naturaleza.PRIVADO) continue;
      expect(problemaDeUnidad(naturaleza, 'una-unidad')).toContain('asignacion');
      expect(problemaDeUnidad(naturaleza, null)).toBeNull();
    }
  });
});
