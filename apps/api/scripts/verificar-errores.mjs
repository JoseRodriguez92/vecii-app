#!/usr/bin/env node
/**
 * Que toda restriccion de la base tenga una traduccion al espanol.
 *
 * Sin esto, el dia que alguien agregue un indice unico el usuario ve
 * "Unique constraint failed on the constraint: `unidades_algo_key`" y nadie se
 * entera hasta que un administrador llama. El verificador lo dice en el lint.
 *
 * Lee los nombres FINALES: recorre las migraciones en orden y aplica los
 * `ALTER INDEX ... RENAME TO` y los `DROP INDEX`, porque la migracion de
 * snake_case renombro 65 indices y usar los nombres viejos no serviria de nada.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRACIONES = 'prisma/migrations';
const MENSAJES = 'src/common/errores/mensajes-de-restriccion.ts';

const carpetas = readdirSync(MIGRACIONES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let unicos = [];
const chequeos = new Set();

for (const carpeta of carpetas) {
  let sql;
  try {
    sql = readFileSync(join(MIGRACIONES, carpeta, 'migration.sql'), 'utf8');
  } catch {
    continue;
  }

  for (const m of sql.matchAll(/CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"?([A-Za-z0-9_]+)"?/g)) {
    unicos.push(m[1]);
  }
  for (const m of sql.matchAll(/ADD CONSTRAINT\s+"?([A-Za-z0-9_]+)"?\s+CHECK/gi)) {
    chequeos.add(m[1]);
  }
  for (const m of sql.matchAll(/ALTER INDEX\s+"?([A-Za-z0-9_]+)"?\s+RENAME TO\s+"?([A-Za-z0-9_]+)"?/g)) {
    unicos = unicos.map((n) => (n === m[1] ? m[2] : n));
  }
  for (const m of sql.matchAll(/DROP INDEX\s+(?:IF EXISTS\s+)?"?([A-Za-z0-9_]+)"?/g)) {
    unicos = unicos.filter((n) => n !== m[1]);
  }
  for (const m of sql.matchAll(/DROP CONSTRAINT\s+(?:IF EXISTS\s+)?"?([A-Za-z0-9_]+)"?/g)) {
    chequeos.delete(m[1]);
  }
}

const fuente = readFileSync(MENSAJES, 'utf8');
const seccion = (nombre) => {
  const desde = fuente.indexOf(`export const ${nombre}`);
  if (desde === -1) return '';
  const siguiente = fuente.indexOf('\nexport const ', desde + 1);
  return fuente.slice(desde, siguiente === -1 ? undefined : siguiente);
};
const clavesDe = (nombre) =>
  new Set([...seccion(nombre).matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]));

const conMensaje = clavesDe('UNICOS');
const internas = clavesDe('INTERNAS');
const conChequeo = clavesDe('CHEQUEOS');

const unicosVigentes = [...new Set(unicos)].sort();
const faltan = unicosVigentes.filter((n) => !conMensaje.has(n) && !internas.has(n));
const chequeosSinMensaje = [...chequeos].filter((n) => !conChequeo.has(n)).sort();

// Al reves: una entrada que ya no corresponde a ninguna restriccion es un
// mensaje muerto que alguien va a leer y creer vigente.
const vigentes = new Set(unicosVigentes);
const sobran = [...conMensaje, ...internas].filter((n) => !vigentes.has(n)).sort();
const chequeosQueSobran = [...conChequeo].filter((n) => !chequeos.has(n)).sort();

console.log(
  `Indices unicos: ${unicosVigentes.length} (${conMensaje.size} con mensaje, ${internas.size} internos) · CHECK: ${chequeos.size}`,
);

const problemas = [];
if (faltan.length) {
  problemas.push(
    `Indices unicos sin mensaje en ${MENSAJES}:\n` +
      faltan.map((n) => `    ${n}`).join('\n') +
      '\n  Agregalo a UNICOS, o a INTERNAS con el motivo por el que nadie lo puede chocar.',
  );
}
if (chequeosSinMensaje.length) {
  problemas.push(
    `CHECK sin mensaje:\n` + chequeosSinMensaje.map((n) => `    ${n}`).join('\n'),
  );
}
if (sobran.length || chequeosQueSobran.length) {
  problemas.push(
    `Mensajes para restricciones que ya no existen:\n` +
      [...sobran, ...chequeosQueSobran].map((n) => `    ${n}`).join('\n'),
  );
}

if (problemas.length) {
  console.error('\n' + problemas.map((p) => `  ✗ ${p}`).join('\n\n') + '\n');
  process.exit(1);
}

console.log('OK — toda restriccion de la base tiene como explicarse en espanol.');
