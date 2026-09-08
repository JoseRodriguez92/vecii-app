-- Que el mismo pago no entre dos veces.
--
-- Toda pasarela reintenta su webhook: si el primero se demoro, manda otro. Sin
-- esto, el segundo crea un pago identico, se imputa a la misma cuenta y el
-- residente queda con un saldo a favor que nunca pago. Y el conjunto cuadra de
-- menos sin saber por que.
--
-- Tambien atrapa lo manual: el administrador que digita la misma consignacion
-- dos veces porque no se acordo.
--
-- `conjunto_id` va adentro A PROPOSITO: dos conjuntos con pasarelas distintas
-- pueden tener ids de transaccion iguales, y un unico global los haria chocar
-- por nada.
--
-- PARCIAL: un pago en efectivo no tiene referencia, y varios sin referencia
-- tienen que poder convivir.
CREATE UNIQUE INDEX "pago_no_entra_dos_veces"
  ON "pagos" ("conjunto_id", "medio", "referencia")
  WHERE "referencia" IS NOT NULL;

-- El aviso de que la plata llego.
ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_REGISTRADO';
