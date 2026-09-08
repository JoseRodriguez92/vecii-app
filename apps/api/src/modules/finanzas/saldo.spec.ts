import { describe, expect, it } from 'vitest';
import { NaturalezaConcepto } from '../../generated/prisma/enums.js';
import { calcularSaldo, estaVencida } from './saldo.js';

const cargo = (valor: number) => ({ valor, naturaleza: NaturalezaConcepto.CARGO });
const abono = (valor: number) => ({ valor, naturaleza: NaturalezaConcepto.ABONO });

describe('cuanto vale la cuenta', () => {
  it('la cuenta de septiembre del 501', () => {
    const r = calcularSaldo([cargo(250_000), cargo(150_000), cargo(12_000)], 0);
    expect(r.total).toBe(412_000);
    expect(r.saldo).toBe(412_000);
  });

  it('un descuento RESTA, no suma', () => {
    // La unica sutileza del calculo. Sumarlo por descuido cobra el descuento en
    // vez de darlo, y el residente paga de mas sin que nadie lo note.
    expect(calcularSaldo([cargo(250_000), abono(20_000)], 0).total).toBe(230_000);
  });

  it('el saldo baja con lo imputado', () => {
    const r = calcularSaldo([cargo(412_000)], 300_000);
    expect(r.pagado).toBe(300_000);
    expect(r.saldo).toBe(112_000);
  });

  it('pagada es saldo cero, no una casilla', () => {
    expect(calcularSaldo([cargo(412_000)], 412_000).saldo).toBe(0);
  });

  it('una cuenta sin lineas vale cero, no revienta', () => {
    expect(calcularSaldo([], 0)).toEqual({ total: 0, pagado: 0, saldo: 0 });
  });
});

describe('cuando esta vencida', () => {
  const ayer = new Date('2026-09-10');
  const hoy = new Date('2026-09-20');

  it('paso la fecha y todavia debe', () => {
    expect(estaVencida(ayer, 412_000, hoy)).toBe(true);
  });

  it('paso la fecha pero ya pago: NO esta vencida', () => {
    expect(estaVencida(ayer, 0, hoy)).toBe(false);
  });

  it('debe todo pero todavia no vence', () => {
    expect(estaVencida(new Date('2026-09-30'), 412_000, hoy)).toBe(false);
  });

  it('un borrador no vence: todavia no se le mostro a nadie', () => {
    expect(estaVencida(null, 412_000, hoy)).toBe(false);
  });
});
