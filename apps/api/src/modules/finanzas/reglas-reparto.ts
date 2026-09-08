/**
 * Repartir un monto entre unidades segun su participacion.
 *
 * Es la cuenta central de la facturacion: el presupuesto del mes se divide entre
 * las unidades por su coeficiente de copropiedad, o el gasto de un sector por el
 * modulo de contribucion de cada una. La operacion es la misma; lo que cambia es
 * que fraccion se usa.
 *
 * Funcion pura y con pruebas porque aqui un error no se ve: produce recibos que
 * parecen normales y una plata que no cuadra a fin de ano.
 */

/** Lo que el conjunto acepta de descuadre entre los coeficientes y el 100%. */
const TOLERANCIA = 0.0001;

export interface Participacion {
  unidadId: string;
  /** Para los mensajes: quien lee es una persona, no un uuid. */
  identificador: string;
  /** Coeficiente de copropiedad o modulo de contribucion. Null = no cargado. */
  fraccion: number | null;
}

export interface Reparto {
  unidadId: string;
  identificador: string;
  /** Pesos enteros. En Colombia una cuota de administracion no lleva centavos. */
  valor: number;
}

/**
 * Por que NO se factura. Se pregunta antes de repartir, no despues.
 *
 * El caso que importa es el de los coeficientes a medias: si una unidad no tiene
 * el suyo cargado, repartir igual significa que el resto paga de mas y esa paga
 * cero — y eso solo se descubre cuando falta la plata. Antes que un recibo malo,
 * un error.
 */
export function problemaAlRepartir(
  montoEnPesos: number,
  participaciones: Participacion[],
): string | null {
  if (!Number.isInteger(montoEnPesos) || montoEnPesos <= 0) {
    return 'El monto a repartir tiene que ser un numero entero de pesos mayor que cero';
  }

  if (participaciones.length === 0) {
    return 'No hay unidades a las que repartir';
  }

  const sinCargar = participaciones.filter((p) => p.fraccion === null);
  if (sinCargar.length > 0) {
    const nombres = sinCargar
      .slice(0, 5)
      .map((p) => p.identificador)
      .join(', ');
    const resto = sinCargar.length > 5 ? ` y ${sinCargar.length - 5} mas` : '';
    return (
      `Hay ${sinCargar.length} unidad(es) sin coeficiente cargado (${nombres}${resto}). ` +
      'Repartir asi haria que las demas paguen de mas.'
    );
  }

  const suma = participaciones.reduce((t, p) => t + (p.fraccion ?? 0), 0);
  if (Math.abs(suma - 1) > TOLERANCIA) {
    return (
      `Los coeficientes suman ${(suma * 100).toFixed(4)}% y tienen que sumar 100%. ` +
      'Revisa el reglamento antes de facturar.'
    );
  }

  return null;
}

/**
 * Reparte, y la suma da EXACTAMENTE el monto.
 *
 * Multiplicar y redondear cada parte por separado no cuadra: con 200 unidades el
 * total queda unos pesos por debajo o por encima, todos los meses, y el
 * presupuesto no cierra sin que nadie sepa por que.
 *
 * Se usa el metodo del resto mayor: a cada unidad le toca la parte entera, y los
 * pesos que sobran van, de a uno, a las que quedaron con la fraccion decimal mas
 * grande. Es el reparto mas justo posible en enteros, y es determinista — dos
 * corridas del mismo mes dan lo mismo, porque los empates se rompen por
 * coeficiente y despues por id.
 *
 * Asume que ya paso `problemaAlRepartir`.
 */
export function repartir(montoEnPesos: number, participaciones: Participacion[]): Reparto[] {
  const exactos = participaciones.map((p) => {
    const exacto = montoEnPesos * (p.fraccion ?? 0);
    const entero = Math.floor(exacto);
    return { ...p, entero, resto: exacto - entero };
  });

  const repartido = exactos.reduce((t, e) => t + e.entero, 0);
  let sobran = montoEnPesos - repartido;

  // El orden decide a quien le toca el peso de mas. Por resto, luego por
  // coeficiente, luego por id: sin el ultimo criterio dos unidades identicas
  // podrian intercambiarse entre corridas.
  const porResto = [...exactos].sort(
    (a, b) =>
      b.resto - a.resto ||
      (b.fraccion ?? 0) - (a.fraccion ?? 0) ||
      a.unidadId.localeCompare(b.unidadId),
  );

  const extra = new Set<string>();
  for (const e of porResto) {
    if (sobran <= 0) break;
    extra.add(e.unidadId);
    sobran -= 1;
  }

  return exactos.map((e) => ({
    unidadId: e.unidadId,
    identificador: e.identificador,
    valor: e.entero + (extra.has(e.unidadId) ? 1 : 0),
  }));
}
