#!/usr/bin/env node
/**
 * Revisa que el vocabulario sea coherente en las cinco capas.
 *
 * Hermano de verificar-schema.mjs. Aquel cuida la forma del schema; este cuida
 * que una misma cosa se llame igual en la tabla, la carpeta, la ruta, el permiso
 * y el tag de Swagger. Ver docs/dominio/glosario.md.
 *
 * Existe porque la coherencia se pierde en silencio: un ADR escrito antes que el
 * glosario decia `seguridad/` y nadie lo noto en semanas.
 *
 * Uso: node scripts/verificar-vocabulario.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no `.pathname`: este ultimo deja el %20 de "Vecii App" sin
// decodificar, y en Windows devuelve rutas como /C:/... que fs no abre.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8');

/** Tags que no nombran un recurso del dominio: son infraestructura. */
const TAGS_DE_INFRA = new Set(['health', 'auth']);

/**
 * Enums que no necesitan entrada en el glosario porque no son vocabulario del
 * dominio: cualquiera sabe que es un dia de la semana. Todo lo demas si, porque
 * un enum ES una lista cerrada de palabras que usa todo el sistema.
 */
const ENUMS_OBVIOS = new Set(['DiaSemana']);

/**
 * Abreviaturas aceptadas a proposito dentro de un modulo, donde repetir el
 * sufijo seria redundante: en el modulo `reservas`, `espacios_reservables` se
 * abrevia `espacios` porque el modulo ya dice de que son.
 */
const ABREVIATURAS = {
  'reservas · espacios': 'espacios_reservables',
  'reservas · politicas': 'politicas_reserva',
  'plataforma · usuarios': 'usuarios_plataforma',
};

const schema = leer('prisma/schema.prisma');
const glosario = readFileSync(join(RAIZ, '..', '..', 'docs/dominio/glosario.md'), 'utf8');
const main = leer('src/main.ts');
const permisos = leer('src/common/permisos.ts');

const tablas = new Set([...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((m) => m[1]));
const enums = [...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]);
const tags = [...main.matchAll(/\.addTag\('([^']+)'/g)].map((m) => m[1]);
const modulos = readdirSync(join(RAIZ, 'src/modules'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const codigosPermiso = [...permisos.matchAll(/^\s+[A-Z_]+: '([a-z_.]+)',/gm)].map((m) => m[1]);
const modulosDeclarados = new Set([...permisos.matchAll(/codigo: '([a-z]+)',/g)].map((m) => m[1]));

const errores = [];
const avisos = [];

// 1. Toda tabla tiene su palabra en el glosario.
for (const tabla of [...tablas].sort()) {
  if (!glosario.includes(tabla)) {
    errores.push(`la tabla \`${tabla}\` no aparece en el glosario`);
  }
}

// 1b. Todo enum tiene su palabra en el glosario.
for (const nombre of enums) {
  if (ENUMS_OBVIOS.has(nombre)) continue;
  if (!glosario.includes(nombre)) {
    errores.push(`el enum \`${nombre}\` no aparece en el glosario`);
  }
}

// 2. Todo tag termina en un nombre de tabla.
for (const tag of tags) {
  if (TAGS_DE_INFRA.has(tag)) continue;
  const esperado = ABREVIATURAS[tag] ?? tag.split('·').pop().trim().replace(/ /g, '_');
  if (!tablas.has(esperado)) {
    errores.push(`el tag "${tag}" no termina en un nombre de tabla (buscaba \`${esperado}\`)`);
  }
}

// 3. Toda carpeta de modules/ es un tag o el prefijo de uno.
for (const modulo of modulos) {
  const usado = tags.some((t) => t === modulo || t.startsWith(`${modulo} ·`));
  if (!usado) errores.push(`la carpeta \`modules/${modulo}\` no corresponde a ningun tag`);
}

// 3b. Toda carpeta de modules/ tiene su modulo en el catalogo.
//
// Este chequeo existe porque su ausencia dejo pasar un hueco: habia una carpeta
// `modules/plataforma` cuyo unico permiso vivia prestado dentro del modulo
// `roles`. Cada regla por separado se cumplia —la carpeta tenia tag, el permiso
// empezaba por un modulo existente— y nadie miraba la relacion entre las dos.
for (const modulo of modulos) {
  if (!modulosDeclarados.has(modulo)) {
    errores.push(
      `la carpeta \`modules/${modulo}\` no tiene su modulo en MODULOS: sus permisos estarian ` +
        'colgados de otro',
    );
  }
}

// 4. Todo permiso empieza por un modulo declarado.
for (const codigo of codigosPermiso) {
  const modulo = codigo.split('.')[0];
  if (!modulosDeclarados.has(modulo)) {
    errores.push(`el permiso \`${codigo}\` empieza por un modulo que no existe en MODULOS`);
  }
}

// 5. Palabras del glosario que ya nadie usa. Un glosario que solo crece se
//    vuelve un cementerio, y ahi deja de leerse.
const fuentes = schema + leer('src/main.ts') + leer('src/common/permisos.ts');
const enCodigo = new Set([...fuentes.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((m) => m[0]));
for (const [, palabra] of glosario.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
  if (!tablas.has(palabra) && !enCodigo.has(palabra) && !palabra.includes('.')) {
    avisos.push(`\`${palabra}\` aparece en el glosario pero no en el codigo`);
  }
}

console.log(`Tablas: ${tablas.size} · enums: ${enums.length} · tags: ${tags.length} · modulos: ${modulos.length} · permisos: ${codigosPermiso.length}\n`);
if (avisos.length) {
  console.log(
    `Posibles fosiles (${[...new Set(avisos)].length}) — revisar a ojo: una palabra puede`,
  );
  console.log('estar ahi como CONTRAEJEMPLO ("no `activa`", "no `seguridad`"), y eso esta bien.');
  for (const a of [...new Set(avisos)]) console.log(`  ? ${a}`);
  console.log();
}
if (errores.length === 0) {
  console.log('OK — el vocabulario es coherente en las cinco capas.');
  process.exit(0);
}
console.error(`${errores.length} incoherencia(s):\n`);
for (const e of errores) console.error(`  - ${e}`);
process.exit(1);
