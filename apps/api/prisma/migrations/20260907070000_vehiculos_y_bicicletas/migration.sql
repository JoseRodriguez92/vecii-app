-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CARRO', 'MOTO');

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" UUID NOT NULL,
    "conjunto_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT,
    "color" TEXT,
    "propietario_id" UUID,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "observacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bicicletas" (
    "id" UUID NOT NULL,
    "conjunto_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "serial" TEXT,
    "marca" TEXT,
    "color" TEXT,
    "propietario_id" UUID,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "observacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bicicletas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehiculos_conjunto_id_placa_idx" ON "vehiculos"("conjunto_id", "placa");

-- CreateIndex
CREATE INDEX "vehiculos_unidad_id_idx" ON "vehiculos"("unidad_id");

-- CreateIndex
CREATE INDEX "bicicletas_conjunto_id_idx" ON "bicicletas"("conjunto_id");

-- CreateIndex
CREATE INDEX "bicicletas_unidad_id_idx" ON "bicicletas"("unidad_id");

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_unidad_id_conjunto_id_fkey" FOREIGN KEY ("unidad_id", "conjunto_id") REFERENCES "unidades"("id", "conjunto_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bicicletas" ADD CONSTRAINT "bicicletas_conjunto_id_fkey" FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bicicletas" ADD CONSTRAINT "bicicletas_unidad_id_conjunto_id_fkey" FOREIGN KEY ("unidad_id", "conjunto_id") REFERENCES "unidades"("id", "conjunto_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bicicletas" ADD CONSTRAINT "bicicletas_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Lo que Prisma no sabe expresar (escrito a mano)
-- ---------------------------------------------------------------------------
-- Una placa vigente por conjunto. El servicio ya lo valida, pero esa validacion
-- solo vale mientras no haya dos peticiones al tiempo: las dos leen que la placa
-- esta libre, las dos escriben, y porteria queda sin saber a que unidad avisarle.
--
-- Va como indice PARCIAL, sobre las vigentes, y no como @@unique. Un unique
-- normal impediria que el 501 le venda el carro al 302: quedarian dos filas con
-- la misma placa, una cerrada y una abierta, que es exactamente lo que tiene que
-- poder pasar.
CREATE UNIQUE INDEX vehiculo_placa_vigente_unica
  ON vehiculos ("conjunto_id", placa)
  WHERE hasta IS NULL;

-- Lo mismo con el serial de una bicicleta, cuando lo hay. Un serial esta grabado
-- en el marco y es unico en el mundo, asi que repetirlo entre dos vigentes es un
-- error de digitacion o la misma bicicleta registrada dos veces.
--
-- Postgres trata los NULL como distintos, asi que las bicicletas sin serial
-- —que van a ser la mitad— caben todas sin estorbarse.
CREATE UNIQUE INDEX bicicleta_serial_vigente_unico
  ON bicicletas ("conjunto_id", serial)
  WHERE hasta IS NULL;
