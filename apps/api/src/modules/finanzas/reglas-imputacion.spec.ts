import { describe, expect, it } from 'vitest';
import { type CuentaPendiente, imputar } from './reglas-imputacion.js';

const cuenta = (mes: string, saldo: number): CuentaPendiente => ({
  cuentaId: `cta-${mes}`,
  periodo: new Date(`2026-${mes}-01`),
  saldo,
});

/** Lo que debe el 501: se atraso en julio y agosto, y septiembre ya salio. */
const elCasoDel501 = [cuenta('07', 310_000), cuenta('08', 300_000), cuenta('09', 412_000)];

describe('la cuenta mas vieja primero', () => {
  it('paga $610.000 y se pone al dia hasta agosto', () => {
    const r = imputar(610_000, elCasoDel501);
    expect(r.aplicaciones).toEqual([
      { cuentaId: 'cta-07', valor: 310_000 },
      { cuentaId: 'cta-08', valor: 300_000 },
    ]);
    expect(r.sobrante).toBe(0);
  });

  it('un pago cubre varias cuentas, y la ultima a medias', () => {
    // Es lo que hace que un acuerdo de pago funcione: abona lo que puede.
    const r = imputar(700_000, elCasoDel501);
    expect(r.aplicaciones.at(-1)).toEqual({ cuentaId: 'cta-09', valor: 90_000 });
  });

  it('el orden no depende de como lleguen las cuentas', () => {
    const alReves = [...elCasoDel501].reverse();
    expect(imputar(610_000, alReves).aplicaciones.map((a) => a.cuentaId)).toEqual([
      'cta-07',
      'cta-08',
    ]);
  });

  it('nunca le aplica a una cuenta mas de lo que debe', () => {
    for (const a of imputar(5_000_000, elCasoDel501).aplicaciones) {
      const original = elCasoDel501.find((c) => c.cuentaId === a.cuentaId)!;
      expect(a.valor).toBeLessThanOrEqual(original.saldo);
    }
  });
});

describe('cuando la plata no calza', () => {
  it('paga de mas: lo que sobra NO se fuerza contra nada', () => {
    // Queda sin imputar, y eso es un saldo a favor. Se deriva de pagos menos
    // imputaciones; guardarlo en un campo seria guardar una conclusion.
    const r = imputar(1_100_000, elCasoDel501);
    expect(r.sobrante).toBe(78_000);
    expect(r.aplicaciones).toHaveLength(3);
  });

  it('no debe nada y paga: todo queda como saldo a favor', () => {
    expect(imputar(200_000, [])).toEqual({ aplicaciones: [], sobrante: 200_000 });
  });

  it('las cuentas ya pagadas se ignoran', () => {
    const r = imputar(100_000, [cuenta('07', 0), cuenta('08', 300_000)]);
    expect(r.aplicaciones).toEqual([{ cuentaId: 'cta-08', valor: 100_000 }]);
  });

  it('un abono chico entra todo a la mas vieja', () => {
    const r = imputar(50_000, elCasoDel501);
    expect(r.aplicaciones).toEqual([{ cuentaId: 'cta-07', valor: 50_000 }]);
    expect(r.sobrante).toBe(0);
  });
});
