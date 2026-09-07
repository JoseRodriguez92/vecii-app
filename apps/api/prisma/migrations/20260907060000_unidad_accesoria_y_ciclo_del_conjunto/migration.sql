-- Dos cosas que la interfaz va a mostrar, y por eso van antes que ella.

-- ---------------------------------------------------------------------------
-- 1. La unidad accesoria
-- ---------------------------------------------------------------------------
-- Comprar el apto 501 es comprar tres unidades: el apartamento, el parqueadero
-- 34 y el deposito 12. Las tres tienen matricula y coeficiente propios, pero
-- nunca se venden aparte. Hasta hoy eran tres filas sin ninguna relacion.
--
-- La FK es COMPUESTA, como todas las de este esquema: apunta a la pareja
-- (unidad, conjunto), asi que Postgres rechaza colgar una unidad de otra que es
-- de otro conjunto.
ALTER TABLE "unidades" ADD COLUMN "unidad_principal_id" UUID;

CREATE INDEX "unidades_unidad_principal_id_idx" ON "unidades"("unidad_principal_id");

ALTER TABLE "unidades" ADD CONSTRAINT "unidades_unidad_principal_id_conjunto_id_fkey"
  FOREIGN KEY ("unidad_principal_id", "conjunto_id")
  REFERENCES "unidades"("id", "conjunto_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Una unidad no es accesoria de si misma. Prisma no sabe expresarlo y la FK
-- tampoco lo impide: apuntarse a uno mismo es una referencia perfectamente
-- valida.
ALTER TABLE "unidades" ADD CONSTRAINT "unidad_no_es_accesoria_de_si_misma"
  CHECK ("unidad_principal_id" IS NULL OR "unidad_principal_id" <> "id");

-- ---------------------------------------------------------------------------
-- 2. El ciclo comercial del conjunto
-- ---------------------------------------------------------------------------
-- ACTIVO y SUSPENDIDO no alcanzaban. "Todavia no arranca" no es lo mismo que
-- "lo suspendimos", y sin CANCELADO dar de baja a un cliente era suspenderlo
-- para siempre o borrarlo.
ALTER TYPE "EstadoConjunto" ADD VALUE 'EN_IMPLEMENTACION' BEFORE 'ACTIVO';
ALTER TYPE "EstadoConjunto" ADD VALUE 'CANCELADO' AFTER 'SUSPENDIDO';
