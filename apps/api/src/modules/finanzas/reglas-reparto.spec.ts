import { describe, expect, it } from 'vitest';
import { type Participacion, problemaAlRepartir, repartir } from './reglas-reparto.js';

const u = (identificador: string, fraccion: number | null): Participacion => ({
  unidadId: `u-${identificador}`,
  identificador,
  fraccion,
});

/** 200 unidades iguales: el caso que descuadra si se redondea de a una. */
const doscientasIguales = Array.from({ length: 200 }, (_, i) => u(`${101 + i}`, 1 / 200));

describe('antes de repartir', () => {
  it('una unidad sin coeficiente detiene la facturacion, no se reparte igual', () => {
    // Si se repartiera, esa unidad pagaria cero y las demas de mas. Y eso solo
    // se descubre cuando falta la plata a fin de ano.
    const problema = problemaAlRepartir(1_000_000, [u('501', 0.5), u('502', null)]);
    expect(problema).toContain('sin coeficiente cargado');
    expect(problema).toContain('502');
  });

  it('nombra hasta cinco y despues cuenta', () => {
    const faltantes = Array.from({ length: 8 }, (_, i) => u(`${i}`, null));
    expect(problemaAlRepartir(1_000_000, faltantes)).toContain('y 3 mas');
  });

  it('los coeficientes tienen que sumar 100%', () => {
    const problema = problemaAlRepartir(1_000_000, [u('501', 0.4), u('502', 0.4)]);
    expect(problema).toContain('80.0000%');
  });

  it('acepta el descuadre minimo del redondeo del reglamento', () => {
    expect(problemaAlRepartir(1_000_000, [u('501', 0.5), u('502', 0.50005)])).toBeNull();
  });

  it('no se factura cero, ni negativo, ni centavos', () => {
    expect(problemaAlRepartir(0, [u('501', 1)])).toContain('mayor que cero');
    expect(problemaAlRepartir(-5, [u('501', 1)])).toContain('mayor que cero');
    expect(problemaAlRepartir(1000.5, [u('501', 1)])).toContain('entero');
  });

  it('sin unidades no hay nada que repartir', () => {
    expect(problemaAlRepartir(1_000_000, [])).toContain('No hay unidades');
  });
});

describe('el reparto', () => {
  it('el caso del apto 501 con su parqueadero y su deposito', () => {
    const r = repartir(24_000_000, [
      u('501', 0.0045),
      u('P-34', 0.0005),
      u('D-12', 0.0002),
      u('resto', 1 - 0.0052),
    ]);
    expect(r.find((x) => x.identificador === '501')?.valor).toBe(108_000);
    expect(r.find((x) => x.identificador === 'P-34')?.valor).toBe(12_000);
    expect(r.find((x) => x.identificador === 'D-12')?.valor).toBe(4_800);
  });

  it('SIEMPRE suma el monto exacto, aunque no divida parejo', () => {
    // Esta es la que importa. 24.000.001 entre 200 no da entero: redondeando de
    // a una, el total quedaria por debajo y el presupuesto no cerraria — todos
    // los meses, y sin que nadie sepa por que.
    const r = repartir(24_000_001, doscientasIguales);
    expect(r.reduce((t, x) => t + x.valor, 0)).toBe(24_000_001);
  });

  it('reparte los pesos sobrantes de a uno, no todos a la misma', () => {
    const r = repartir(100, [u('a', 1 / 3), u('b', 1 / 3), u('c', 1 / 3)]);
    expect(r.reduce((t, x) => t + x.valor, 0)).toBe(100);
    // 33.33 cada una: UNA recibe 34 y dos reciben 33. Nadie recibe 35, que es
    // lo que pasaria si el sobrante se le cargara todo a la misma.
    expect(r.map((x) => x.valor).sort()).toEqual([33, 33, 34]);
  });

  it('todos los valores son enteros: una cuota no lleva centavos', () => {
    for (const x of repartir(24_000_001, doscientasIguales)) {
      expect(Number.isInteger(x.valor)).toBe(true);
    }
  });

  it('es determinista: dos corridas del mismo mes dan lo mismo', () => {
    const a = repartir(1_000_000, [u('501', 1 / 3), u('502', 1 / 3), u('503', 1 / 3)]);
    const b = repartir(1_000_000, [u('501', 1 / 3), u('502', 1 / 3), u('503', 1 / 3)]);
    expect(a).toEqual(b);
  });

  it('devuelve una fila por unidad, en el orden en que llegaron', () => {
    const r = repartir(1_000_000, [u('501', 0.5), u('502', 0.5)]);
    expect(r.map((x) => x.identificador)).toEqual(['501', '502']);
  });
});
