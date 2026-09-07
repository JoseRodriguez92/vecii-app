-- Restricciones que Prisma no sabe expresar.
--
-- Van en su propia migracion, no pegadas a la linea base: la linea base se marca
-- como aplicada sin ejecutarse (la base ya existe, la construyo `db push`), asi
-- que lo que se pegue ahi nunca llega a Postgres. Estas si tienen que correr.
--
-- OJO con los nombres: las TABLAS estan en snake_case (por @@map) pero las
-- COLUMNAS quedaron en camelCase, porque nunca les pusimos @map. Por eso van
-- entre comillas dobles. Ver el pendiente de normalizar eso.

-- ---------------------------------------------------------------------------
-- unidades: dos "101" en un edificio sin torres
-- ---------------------------------------------------------------------------
-- @@unique([conjuntoId, agrupacionId, identificador]) no lo impide: Postgres
-- trata los NULL como distintos, asi que un edificio sin agrupaciones admite dos
-- apartamentos 101. Ahi seria un error de digitacion.
CREATE UNIQUE INDEX unidad_identificador_sin_agrupacion
  ON unidades ("conjuntoId", identificador)
  WHERE "agrupacionId" IS NULL;

-- ---------------------------------------------------------------------------
-- encomiendas: el destino es UNO
-- ---------------------------------------------------------------------------
-- Los dos campos son opcionales para permitir los tres destinos (unidad, torre,
-- conjunto entero), pero llenar los dos es incoherente.
ALTER TABLE encomiendas ADD CONSTRAINT encomienda_destino_unico
  CHECK (NOT ("unidadId" IS NOT NULL AND "agrupacionId" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- espacios_reservables: apunta a UNA cosa
-- ---------------------------------------------------------------------------
-- Un espacio es una zona comun concreta o un pool de parqueaderos. Ni las dos ni
-- ninguna.
ALTER TABLE espacios_reservables ADD CONSTRAINT espacio_apunta_a_algo
  CHECK (("zonaComunId" IS NULL) <> ("naturalezaParqueadero" IS NULL));

-- ---------------------------------------------------------------------------
-- roles: un rol de plataforma no pertenece a un conjunto
-- ---------------------------------------------------------------------------
-- OJO, la implicacion va en UN solo sentido y no en los dos:
--
--   ambito = PLATAFORMA  ->  conjuntoId TIENE que ser null
--   ambito = CONJUNTO    ->  puede ser null (los cargos estandar, que comparten
--                            los 400 conjuntos) o tener valor (los inventados)
--
-- El CHECK que teniamos anotado era `(ambito = 'PLATAFORMA') = (conjuntoId IS
-- NULL)`, una equivalencia, y habria rechazado a CONSEJO — que es de ambito
-- CONJUNTO y vive sin conjunto.
ALTER TABLE roles ADD CONSTRAINT rol_plataforma_sin_conjunto
  CHECK (ambito <> 'PLATAFORMA' OR "conjuntoId" IS NULL);

-- Un solo cargo estandar por codigo. @@unique([conjuntoId, codigo]) no lo impide
-- por lo mismo de siempre: los NULL son distintos entre si.
CREATE UNIQUE INDEX rol_estandar_codigo_unico
  ON roles (codigo)
  WHERE "conjuntoId" IS NULL;
