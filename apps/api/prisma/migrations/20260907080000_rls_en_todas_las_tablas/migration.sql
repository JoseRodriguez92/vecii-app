-- Se le cierra la puerta a la API de Supabase.
--
-- Supabase expone por REST todas las tablas del esquema `public`, y lo unico que
-- decide quien ve que ahi es RLS. Sin RLS, la llave publicable —que es publica
-- por diseño y viaja dentro de la app— abre las 25 tablas saltandose el backend
-- por completo. Hoy no importa porque no hay app publicada; el dia del primer
-- build si.
--
-- Se habilita RLS y NO se escribe ninguna politica. Postgres entonces busca una
-- que permita el acceso, no encuentra ninguna, y niega a todos. Es una puerta
-- cerrada con llave, no una puerta con portero.
--
-- Y es a proposito que no haya politicas. Escribirlas significaria replicar en
-- SQL los 27 permisos y la matriz de roles —unas cien politicas entre SELECT,
-- INSERT, UPDATE y DELETE por 25 tablas— y tener dos sistemas de autorizacion
-- que hay que mantener de acuerdo para siempre. La autorizacion vive en el guard
-- de Nest, en un solo lugar, y ahi se queda.
--
-- Consecuencia asumida: Supabase Realtime deja de servir directo al cliente. El
-- tiempo real se construye en Nest, donde el guard ya sabe quien es cada quien.
--
-- OJO: se usa ENABLE y no FORCE. La diferencia importa: FORCE aplicaria RLS
-- tambien al DUEÑO de la tabla, y por ahi entra Prisma. Con ENABLE, `postgres` y
-- `service_role` siguen pasando; `anon` y `authenticated` no.

ALTER TABLE "agrupaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asignaciones_parqueadero" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bicicletas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "casilleros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conjuntos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encomiendas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "espacios_reservables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "horarios_zona_comun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modulos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parqueaderos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permisos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "politicas_reserva" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles_permisos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipologias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario_conjunto_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_conjuntos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_plataforma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehiculos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zonas_comunes" ENABLE ROW LEVEL SECURITY;
