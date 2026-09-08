-- Cobranza: que se le cobra a una unidad, y con que plata se cubrio.
--
-- Cinco tablas y ninguna guarda un total, un saldo ni un estado: los tres se
-- derivan. Un `pagado: boolean` se contradice solo en cuanto llega un abono
-- parcial o rebota un cheque.

CREATE TYPE "CodigoConcepto" AS ENUM ('ADMINISTRACION', 'INTERES_MORA', 'CUOTA_EXTRAORDINARIA');
CREATE TYPE "NaturalezaConcepto" AS ENUM ('CARGO', 'ABONO');
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'CONSIGNACION', 'TRANSFERENCIA', 'PASARELA');

CREATE TABLE "conceptos_cobro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" "CodigoConcepto",
    "naturaleza" "NaturalezaConcepto" NOT NULL DEFAULT 'CARGO',
    "tarifa" DECIMAL(14,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conceptos_cobro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cuentas_cobro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "emitida_en" TIMESTAMP(3),
    "vence_el" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuentas_cobro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cobros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "concepto_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "recibido_en" TIMESTAMP(3) NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "registrado_por_id" UUID,
    "anulado_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imputaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "pago_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "imputaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conceptos_cobro_conjunto_id_nombre_key" ON "conceptos_cobro"("conjunto_id", "nombre");
CREATE UNIQUE INDEX "conceptos_cobro_conjunto_id_codigo_key" ON "conceptos_cobro"("conjunto_id", "codigo");
CREATE UNIQUE INDEX "conceptos_cobro_id_conjunto_id_key" ON "conceptos_cobro"("id", "conjunto_id");
CREATE INDEX "conceptos_cobro_conjunto_id_idx" ON "conceptos_cobro"("conjunto_id");

CREATE UNIQUE INDEX "cuentas_cobro_unidad_id_periodo_key" ON "cuentas_cobro"("unidad_id", "periodo");
CREATE UNIQUE INDEX "cuentas_cobro_id_conjunto_id_key" ON "cuentas_cobro"("id", "conjunto_id");
CREATE INDEX "cuentas_cobro_conjunto_id_vence_el_idx" ON "cuentas_cobro"("conjunto_id", "vence_el");
CREATE INDEX "cuentas_cobro_unidad_id_idx" ON "cuentas_cobro"("unidad_id");

CREATE INDEX "cobros_cuenta_id_idx" ON "cobros"("cuenta_id");
CREATE INDEX "cobros_concepto_id_idx" ON "cobros"("concepto_id");

CREATE UNIQUE INDEX "pagos_id_conjunto_id_key" ON "pagos"("id", "conjunto_id");
CREATE INDEX "pagos_conjunto_id_recibido_en_idx" ON "pagos"("conjunto_id", "recibido_en");
CREATE INDEX "pagos_unidad_id_idx" ON "pagos"("unidad_id");

CREATE UNIQUE INDEX "imputaciones_pago_id_cuenta_id_key" ON "imputaciones"("pago_id", "cuenta_id");
CREATE INDEX "imputaciones_cuenta_id_idx" ON "imputaciones"("cuenta_id");

ALTER TABLE "conceptos_cobro" ADD CONSTRAINT "conceptos_cobro_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imputaciones" ADD CONSTRAINT "imputaciones_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK compuestas: nada de un conjunto puede apuntar a algo de otro.
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_unidad_id_conjunto_id_fkey"
  FOREIGN KEY ("unidad_id", "conjunto_id") REFERENCES "unidades"("id", "conjunto_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_cuenta_id_conjunto_id_fkey"
  FOREIGN KEY ("cuenta_id", "conjunto_id") REFERENCES "cuentas_cobro"("id", "conjunto_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_concepto_id_conjunto_id_fkey"
  FOREIGN KEY ("concepto_id", "conjunto_id") REFERENCES "conceptos_cobro"("id", "conjunto_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_unidad_id_conjunto_id_fkey"
  FOREIGN KEY ("unidad_id", "conjunto_id") REFERENCES "unidades"("id", "conjunto_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_fkey"
  FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "imputaciones" ADD CONSTRAINT "imputaciones_pago_id_conjunto_id_fkey"
  FOREIGN KEY ("pago_id", "conjunto_id") REFERENCES "pagos"("id", "conjunto_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "imputaciones" ADD CONSTRAINT "imputaciones_cuenta_id_conjunto_id_fkey"
  FOREIGN KEY ("cuenta_id", "conjunto_id") REFERENCES "cuentas_cobro"("id", "conjunto_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Un concepto que el sistema genera solo no se puede apagar: sin ADMINISTRACION
-- el proceso mensual no tendria donde poner la cuota.
ALTER TABLE "conceptos_cobro" ADD CONSTRAINT "concepto_del_sistema_no_se_apaga"
  CHECK ("codigo" IS NULL OR "activo");

-- Cobrar cero no es cobrar, y cobrar negativo es un descuento — y para eso esta
-- la naturaleza ABONO, no un valor con signo.
ALTER TABLE "cobros" ADD CONSTRAINT "cobro_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "pagos" ADD CONSTRAINT "pago_valor_positivo" CHECK ("valor" > 0);
ALTER TABLE "imputaciones" ADD CONSTRAINT "imputacion_valor_positivo" CHECK ("valor" > 0);

-- Anular es un hecho con motivo: sin el, dentro de un ano nadie sabe por que se
-- cayo ese pago.
ALTER TABLE "pagos" ADD CONSTRAINT "anulacion_con_motivo"
  CHECK (("anulado_en" IS NULL) = ("motivo_anulacion" IS NULL));

ALTER TABLE "conceptos_cobro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuentas_cobro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cobros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "imputaciones" ENABLE ROW LEVEL SECURITY;
