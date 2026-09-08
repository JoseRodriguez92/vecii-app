/**
 * A que deudas se le aplica un pago.
 *
 * La regla es **la cuenta mas vieja primero**, y no es una preferencia: si se
 * dejara elegir, todo el mundo pagaria lo nuevo y la deuda vieja envejeceria
 * sola, que es exactamente lo que hace impagable una cartera.
 *
 * Esto simplifica ademas la imputacion legal. El Codigo Civil (art. 1653) manda
 * abonar primero a los intereses, pero aqui los intereses ya vienen ADENTRO de
 * cada cuenta como una linea mas: cubrir la cuenta mas vieja cubre sus intereses
 * con ella.
 *
 * Funcion pura y con pruebas porque un error acá se mide en pesos mal aplicados,
 * y produce estados de cuenta que parecen normales.
 */

export interface CuentaPendiente {
  cuentaId: string;
  /** El mes que cubre. Es lo que decide el orden. */
  periodo: Date;
  /** Lo que falta de esa cuenta. Se asume mayor que cero. */
  saldo: number;
}

export interface Aplicacion {
  cuentaId: string;
  valor: number;
}

export interface Imputado {
  aplicaciones: Aplicacion[];
  /**
   * Lo que sobro porque pago mas de lo que debia.
   *
   * NO se fuerza contra nada: queda sin imputar, y eso es un saldo a favor. Se
   * deriva —pagos menos imputaciones de esa unidad— y lo cubre la cuenta del mes
   * siguiente. Guardarlo como un campo seria guardar una conclusion.
   */
  sobrante: number;
}

export function imputar(monto: number, pendientes: CuentaPendiente[]): Imputado {
  // De la mas vieja a la mas nueva. El desempate por id mantiene el resultado
  // estable si dos cuentas comparten periodo, que no deberia pasar pero pasa.
  const enOrden = [...pendientes]
    .filter((c) => c.saldo > 0)
    .sort(
      (a, b) => a.periodo.getTime() - b.periodo.getTime() || a.cuentaId.localeCompare(b.cuentaId),
    );

  const aplicaciones: Aplicacion[] = [];
  let porRepartir = monto;

  for (const cuenta of enOrden) {
    if (porRepartir <= 0) break;
    // Lo que alcance: la ultima cuenta suele quedar cubierta a medias, y eso
    // esta bien — es lo que hace que un acuerdo de pago funcione.
    const valor = Math.min(porRepartir, cuenta.saldo);
    aplicaciones.push({ cuentaId: cuenta.cuentaId, valor });
    porRepartir -= valor;
  }

  return { aplicaciones, sobrante: porRepartir };
}
