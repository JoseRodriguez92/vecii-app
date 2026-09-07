#!/usr/bin/env node
/**
 * Revisa el schema de Prisma ANTES de generar una migracion.
 *
 * Existe porque los errores que mas costaron en este repo no fueron de diseno,
 * fueron de edicion: un reemplazo de texto que coincidio de mas y duplico un
 * campo, o que inyecto una relacion en el modelo equivocado. Prisma los
 * detecta, pero con un P1012 que no dice donde.
 *
 * Verifica cuatro cosas:
 *   1. Ningun modelo tiene un campo repetido.
 *   2. Toda relacion tiene su inversa declarada del otro lado.
 *   3. Todo modelo tiene @@map (convencion del repo: tablas en snake_case).
 *   4. Toda columna tambien, via @map.
 *
 * La cuarta llego tarde, y por eso esta escrita. Durante meses las tablas
 * estuvieron en snake_case y las columnas se quedaron con el nombre de
 * TypeScript. No rompia nada —Prisma traduce solo— pero cobraba en cada consulta
 * a mano: en DBeaver toda columna con mayuscula necesita comillas dobles, y sin
 * ellas Postgres la pasa a minusculas y responde que no existe. Se arreglaron
 * 122 columnas de un golpe; la regla esta aqui para que la 123 no vuelva a
 * entrar sola.
 *
 * Uso: node scripts/verificar-schema.mjs [ruta/al/schema.prisma]
 */
import { readFileSync } from 'node:fs';

const ruta = process.argv[2] ?? 'prisma/schema.prisma';
const texto = readFileSync(ruta, 'utf8');

/** `numeroDocumento` -> `numero_documento`. `areaM2` -> `area_m2`. */
const aSnake = (nombre) => nombre.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

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
  const map = linea.match(/@map\("([^"]+)"\)/);
  actual.campos.push({
    nombre,
    tipo,
    esLista: Boolean(lista),
    nombreRelacion: rel ? rel[1] : null,
    map: map ? map[1] : null,
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

  // Columnas en snake_case. Solo aplica a los campos que SON columna: una
  // relacion no lo es, y un campo que ya se llama igual de los dos lados no
  // necesita decirlo dos veces.
  for (const campo of modelo.campos) {
    if (modelos.has(campo.tipo)) continue;
    const esperado = aSnake(campo.nombre);
    if (campo.nombre === esperado) continue;
    if (!campo.map) {
      problemas.push(
        `${nombreModelo}.${campo.nombre}: le falta @map("${esperado}") — la columna quedaria ` +
          'en camelCase y habria que entrecomillarla en todo SQL a mano',
      );
    } else if (campo.map !== esperado) {
      problemas.push(
        `${nombreModelo}.${campo.nombre}: su @map dice "${campo.map}" y deberia decir ` +
          `"${esperado}"`,
      );
    }
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
  console.log(
    'OK — sin campos duplicados, sin relaciones huerfanas, tablas y columnas en snake_case.',
  );
  process.exit(0);
}
console.error(`\n${problemas.length} problema(s):\n`);
for (const p of problemas) console.error(`  - ${p}`);
process.exit(1);
