#!/usr/bin/env node
/**
 * Toda tabla tiene RLS habilitado en alguna migracion.
 *
 * Existe porque este hueco se cierra una vez y se vuelve a abrir solo. Supabase
 * expone por REST todas las tablas del esquema `public`, y lo unico que decide
 * quien ve que ahi es RLS. La llave publicable es publica por diseño —viaja
 * dentro de la app— asi que una tabla sin RLS es una tabla que cualquiera lee y
 * escribe, saltandose el backend por completo.
 *
 * La tabla 26 se va a crear con `migrate dev`, que genera el CREATE TABLE y
 * nada mas. Nadie se va a acordar del ALTER. Por eso lo revisa un script y no la
 * memoria.
 *
 * No consulta la base: compara el schema contra los archivos de migracion. Corre
 * sin conexion y sin credenciales, como los otros tres.
 *
 * Uso: node scripts/verificar-rls.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const schema = readFileSync(join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const tablas = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((m) => m[1]);

const dir = join(RAIZ, 'prisma/migrations');
let sql = '';
for (const entrada of readdirSync(dir)) {
  const ruta = join(dir, entrada, 'migration.sql');
  try {
    if (statSync(ruta).isFile()) sql += readFileSync(ruta, 'utf8');
  } catch {
    // migration_lock.toml y demas: no son carpetas de migracion.
  }
}

/** `ALTER TABLE "x" ENABLE ROW LEVEL SECURITY` en cualquier migracion. */
const conRls = new Set(
  [...sql.matchAll(/ALTER TABLE\s+"?([a-z_]+)"?\s+ENABLE ROW LEVEL SECURITY/gi)].map((m) => m[1]),
);

const sinRls = tablas.filter((t) => !conRls.has(t));

console.log(`Tablas: ${tablas.length} · con RLS: ${tablas.length - sinRls.length}`);

if (sinRls.length === 0) {
  console.log('OK — ninguna tabla queda expuesta por la API de Supabase.');
  process.exit(0);
}

console.error(`\n${sinRls.length} tabla(s) sin RLS:\n`);
for (const t of sinRls) console.error(`  - ${t}`);
console.error(
  '\nSin RLS, esa tabla la lee y la escribe cualquiera que tenga la llave publicable,\n' +
    'que va dentro de la app. Agrega a la migracion que la crea:\n\n' +
    sinRls.map((t) => `  ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join('\n') +
    '\n\nSin politicas: la autorizacion vive en el guard de Nest, no en Postgres.\n',
);
process.exit(1);
