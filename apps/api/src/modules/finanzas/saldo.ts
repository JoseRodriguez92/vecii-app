import { NaturalezaConcepto } from '../../generated/prisma/enums.js';

/**
 * Cuanto vale una cuenta y cuanto falta pagarle.
 *
 * Ninguno de los dos se guarda: se calculan cada vez. Un `total` en la fila se
 * desactualiza en cuanto alguien corrige una linea, y un `pagado: boolean` se
 * contradice en cuanto llega un abono parcial o rebota un cheque.
 *
 * Es puro y tiene pruebas porque encierra la unica sutileza del calculo: un
 * concepto de naturaleza ABONO —el descuento por pronto pago— RESTA. Sumarlo
 * por descuido cobra el descuento en vez de darlo.
 */

export interface LineaDeCuenta {
  valor: number;
  naturaleza: NaturalezaConcepto;
}

export interface SaldoDeCuenta {
  /** Lo que se cobro, ya con los descuentos restados. */
  total: number;
  /** Lo que se le ha aplicado de pagos. */
  pagado: number;
  /** Lo que falta. Cero = la cuenta esta al dia. */
  saldo: number;
}

export function calcularSaldo(lineas: LineaDeCuenta[], imputado: number): SaldoDeCuenta {
  const total = lineas.reduce(
    (t, l) => t + (l.naturaleza === NaturalezaConcepto.ABONO ? -l.valor : l.valor),
    0,
  );
  return { total, pagado: imputado, saldo: total - imputado };
}

/**
 * Vencida = paso la fecha Y todavia debe.
 *
 * Las dos condiciones: una cuenta pagada el dia 3 no esta vencida el dia 20, y
 * una que todavia no vence tampoco lo esta aunque deba todo.
 */
export function estaVencida(venceEl: Date | null, saldo: number, hoy = new Date()): boolean {
  return venceEl !== null && saldo > 0 && venceEl < hoy;
}
