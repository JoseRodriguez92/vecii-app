-- El segundo reparto: modulos de contribucion por sector (Ley 675, arts. 3 y 31).
--
-- El coeficiente de copropiedad reparte lo de TODOS y pesa el voto en asamblea.
-- El modulo de contribucion reparte el gasto de un SECTOR: los locales no pagan
-- el ascensor de las torres. En uso comercial o mixto la ley lo exige.

CREATE TABLE "sectores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unidades_sectores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conjunto_id" UUID NOT NULL,
    "sector_id" UUID NOT NULL,
    "unidad_id" UUID NOT NULL,
    "modulo" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unidades_sectores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sectores_conjunto_id_nombre_key" ON "sectores"("conjunto_id", "nombre");
CREATE UNIQUE INDEX "sectores_id_conjunto_id_key" ON "sectores"("id", "conjunto_id");
CREATE INDEX "sectores_conjunto_id_idx" ON "sectores"("conjunto_id");

CREATE UNIQUE INDEX "unidades_sectores_sector_id_unidad_id_key" ON "unidades_sectores"("sector_id", "unidad_id");
CREATE INDEX "unidades_sectores_conjunto_id_idx" ON "unidades_sectores"("conjunto_id");
CREATE INDEX "unidades_sectores_unidad_id_idx" ON "unidades_sectores"("unidad_id");

ALTER TABLE "sectores" ADD CONSTRAINT "sectores_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "unidades_sectores" ADD CONSTRAINT "unidades_sectores_conjunto_id_fkey"
  FOREIGN KEY ("conjunto_id") REFERENCES "conjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK COMPUESTAS: un sector del conjunto A no puede recibir una unidad del
-- conjunto B. La incoherencia se vuelve imposible de escribir, venga del API o
-- de SQL a mano.
ALTER TABLE "unidades_sectores" ADD CONSTRAINT "unidades_sectores_sector_id_conjunto_id_fkey"
  FOREIGN KEY ("sector_id", "conjunto_id") REFERENCES "sectores"("id", "conjunto_id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "unidades_sectores" ADD CONSTRAINT "unidades_sectores_unidad_id_conjunto_id_fkey"
  FOREIGN KEY ("unidad_id", "conjunto_id") REFERENCES "unidades"("id", "conjunto_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Un modulo es una fraccion de 1. Negativo o mayor que 1 no significa nada, y
-- un cero tecleado de mas dejaria a esa unidad sin pagar su parte del sector
-- sin que nadie lo note hasta que falte la plata.
ALTER TABLE "unidades_sectores" ADD CONSTRAINT "modulo_es_una_fraccion"
  CHECK ("modulo" IS NULL OR ("modulo" > 0 AND "modulo" <= 1));

-- Sin politicas: deny-all para anon y authenticated. La autorizacion vive en el
-- guard de Nest; Prisma entra como dueno de la tabla y no la evalua.
ALTER TABLE "sectores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unidades_sectores" ENABLE ROW LEVEL SECURITY;
