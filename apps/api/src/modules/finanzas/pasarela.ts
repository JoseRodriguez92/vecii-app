/**
 * Lo que Vecii le pide a una pasarela de pagos. Todavia sin implementar ninguna.
 *
 * Cada conjunto usa la suya —Wompi, ePayco, PayU, la de su banco— y eso NO es un
 * problema, porque `pagos` guarda el hecho (entro plata, tanto, con esta
 * referencia) y no el mecanismo. Un pago de cualquiera de ellas produce la misma
 * fila que uno que el administrador teclea del extracto.
 *
 * Lo unico que cambia entre proveedores son estos tres metodos. El segundo
 * adaptador cuesta un archivo, no un refactor.
 *
 * ## Lo importante cuando se implemente
 *
 * La cuenta de la pasarela es **del conjunto, con su NIT**. La plata va directo
 * del residente a la copropiedad; Vecii integra y anota, no recauda. Ver
 * ADR-0008.
 *
 * Y toda pasarela **reintenta su webhook**: si el primero se demoro, manda otro.
 * Por eso `referenciaExterna` va al `referencia` del pago, que tiene un unico
 * parcial por (conjunto, medio, referencia). El segundo intento choca contra la
 * base en vez de crear plata que nadie pago.
 */

export interface IntencionDePago {
  /** A donde mandar al residente para que pague. */
  url: string;
  /** El id de la pasarela. Termina en `pagos.referencia`. */
  referenciaExterna: string;
}

/** Lo que se entiende de un webhook, ya normalizado y sin el vocabulario de cada proveedor. */
export interface AvisoDePago {
  referenciaExterna: string;
  /** Solo se registra el pago cuando esto es true. Un rechazo no es plata. */
  aprobado: boolean;
  /** En pesos enteros, como todo el resto del modulo. */
  valor: number;
  /** Cuando la pasarela dice que entro, no cuando llego el webhook. */
  recibidoEn: Date;
}

export interface PasarelaDePagos {
  /** Arma el cobro y devuelve a donde mandar al residente. */
  crearIntencion(entrada: {
    cuentaId: string;
    valor: number;
    descripcion: string;
  }): Promise<IntencionDePago>;

  /**
   * Verifica que el webhook venga de verdad de la pasarela.
   *
   * Sin esto, cualquiera que sepa la URL puede inventar pagos. Cada proveedor
   * firma distinto, y por eso este metodo existe.
   */
  verificarFirma(cuerpo: unknown, cabeceras: Record<string, string>): boolean;

  /** Traduce el evento del proveedor a algo que este modulo entienda. */
  leerAviso(cuerpo: unknown): AvisoDePago;
}
