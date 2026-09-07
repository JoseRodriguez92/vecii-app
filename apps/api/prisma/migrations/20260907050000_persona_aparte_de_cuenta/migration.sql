-- La persona se separa de la cuenta.
--
-- `usuarios.id` era el `sub` de Supabase, asi que una persona no podia existir
-- sin cuenta. Ahora el id es propio y `cuenta_id` guarda el de Supabase cuando
-- la persona tiene con que entrar.
--
-- El UPDATE es lo que hace que esto no rompa nada: todas las filas que ya
-- existen SI tienen cuenta, y su id ES el de Supabase. Se copia tal cual, y
-- desde ese momento el guard las encuentra por `cuenta_id`.
--
-- El `id` no cambia en nadie. Eso es a proposito: siete tablas lo referencian y
-- moverlo seria rehacer esas conexiones persona por persona. Justamente lo que
-- esta migracion existe para no tener que hacer nunca.
ALTER TABLE "usuarios" ADD COLUMN "cuenta_id" UUID;

UPDATE "usuarios" SET "cuenta_id" = "id";

CREATE UNIQUE INDEX "usuarios_cuenta_id_key" ON "usuarios"("cuenta_id");
