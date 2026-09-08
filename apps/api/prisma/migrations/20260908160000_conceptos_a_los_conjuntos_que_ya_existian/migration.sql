-- Los conjuntos creados ANTES de que existiera la siembra no tienen sus
-- conceptos de cobro. Facturar ahi falla con "este conjunto no tiene el concepto
-- ADMINISTRACION", que es correcto pero llega tarde: el administrador ya intento
-- cerrar el mes.
--
-- De aqui en adelante los crea `conjuntos/siembra.ts` en la misma transaccion
-- que el conjunto. Esto es solo para los que ya estaban.
--
-- `WHERE NOT EXISTS` la hace repetible: correrla de nuevo no duplica nada.
INSERT INTO "conceptos_cobro" ("id", "conjunto_id", "nombre", "codigo", "naturaleza", "created_at", "updated_at")
SELECT gen_random_uuid(), c."id", v.nombre, v.codigo::"CodigoConcepto", 'CARGO', now(), now()
FROM "conjuntos" c
CROSS JOIN (VALUES
  ('Administracion',       'ADMINISTRACION'),
  ('Interes de mora',      'INTERES_MORA'),
  ('Cuota extraordinaria', 'CUOTA_EXTRAORDINARIA')
) AS v(nombre, codigo)
WHERE NOT EXISTS (
  SELECT 1 FROM "conceptos_cobro" cc
  WHERE cc."conjunto_id" = c."id" AND cc."codigo" = v.codigo::"CodigoConcepto"
);
