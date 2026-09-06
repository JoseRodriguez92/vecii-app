#!/usr/bin/env node
/**
 * Revisa el schema de Prisma ANTES de correr `db push`.
 *
 * Existe porque los errores que mas costaron en este repo no fueron de diseno,
 * fueron de edicion: un reemplazo de texto que coincidio de mas y duplico un
 * campo, o que inyecto una relacion en el modelo equivocado. Prisma los
 * detecta, pero con un P1012 que no dice donde.
 *
 * Verifica tres cosas:
 *   1. Ningun modelo tiene un campo repetido.
 *   2. Toda relacion tiene su inversa declarada del otro lado.
 *   3. Todo modelo tiene @@map (convencion del repo: tablas en snake_case).
 *
 * Uso: node scripts/verificar-schema.mjs [ruta/al/schema.prisma]
 */
import { readFileSync } from 'node:fs';

const ruta = process.argv[2] ?? 'prisma/schema.prisma';
const texto = readFileSync(ruta, 'utf8');

/** Quita los comentarios `///` y `//` para no confundirlos con codigo. */
const sinComentarios = (linea) => linea.replace(/\/\/.*$/, '').trimEnd();

// --- Parseo de modelos -----------------------------------------------------

const modelos = new Map();

let actual = null;
for (const cruda of texto.split('\n')) {
  const linea = sinComentarios(cruda);
  const abre = linea.match(/^model\s+(\w+)\s*\{/);
  if (abre) {
    actual = { nombre: abre[1], campos: [], tieneMap: false };
    modelos.set(abre[1], actual);
    continue;
  }
  if (!actual) continue;
  if (/^\}/.test(linea)) {
    actual = null;
    continue;
  }
  if (/@@map\(/.test(linea)) actual.tieneMap = true;
  if (/^\s*@@/.test(linea)) continue;

  const campo = linea.match(/^\s{2,}(\w+)\s+(\w+)(\[\])?(\?)?/);
  if (!campo) continue;
  const [, nombre, tipo, lista] = campo;
  const rel = linea.match(/@relation\(\s*"([^"]+)"/);
  actual.campos.push({
    nombre,
    tipo,
    esLista: Boolean(lista),
    nombreRelacion: rel ? rel[1] : null,
  });
}

// --- Verificaciones --------------------------------------------------------

const problemas = [];

for (const [nombreModelo, modelo] of modelos) {
  const vistos = new Map();
  for (const campo of modelo.campos) {
    if (vistos.has(campo.nombre)) {
      problemas.push(`${nombreModelo}: el campo "${campo.nombre}" esta declarado dos veces`);
    }
    vistos.set(campo.nombre, true);
  }

  if (!modelo.tieneMap) {
    problemas.push(`${nombreModelo}: le falta @@map(...) — la tabla quedaria en PascalCase`);
  }

  for (const campo of modelo.campos) {
    const destino = modelos.get(campo.tipo);
    if (!destino) continue;
    const inversa = destino.campos.find(
      (c) => c.tipo === nombreModelo && c.nombreRelacion === campo.nombreRelacion,
    );
    if (!inversa) {
      const etiqueta = campo.nombreRelacion ? ` (relacion "${campo.nombreRelacion}")` : '';
      problemas.push(
        `${nombreModelo}.${campo.nombre} apunta a ${campo.tipo}${etiqueta}, ` +
          `pero ${campo.tipo} no declara la inversa`,
      );
    }
  }
}

console.log(`Modelos revisados: ${modelos.size}`);
if (problemas.length === 0) {
  console.log('OK — sin campos duplicados, sin relaciones huerfanas, todos con @@map.');
  process.exit(0);
}
console.error(`\n${problemas.length} problema(s):\n`);
for (const p of problemas) console.error(`  - ${p}`);
process.exit(1);
