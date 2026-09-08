#!/usr/bin/env node
/**
 * Que ninguna ruta quede tapada por otra declarada antes.
 *
 * Express prueba las rutas en el orden en que se declaran. Si `@Get(':id')` va
 * antes que `@Get('mias')`, la peticion a `/encomiendas/mias` entra por `:id`,
 * el `ParseUUIDPipe` la rechaza, y el cliente recibe un 400 de "uuid esperado"
 * que no dice nada del problema real.
 *
 * Pasa el lint, pasa tsc, y solo se ve cuando alguien toca un aviso y no abre.
 * Ya habia dos comentarios "OJO: va ANTES de ':id'" escritos a mano en dos
 * controladores distintos; un comentario que hay que repetir es una regla que
 * le falta a alguna herramienta.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'src';

function* controladores(dir) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'generated') continue;
      yield* controladores(ruta);
    } else if (entrada.name.endsWith('.controller.ts')) {
      yield ruta;
    }
  }
}

/** ¿La ruta `antes` se traga a `despues`? Mismo largo, y cada segmento coincide o es parametro. */
function tapa(antes, despues) {
  if (antes.length !== despues.length) return false;
  return antes.every((seg, i) => seg.startsWith(':') || seg === despues[i]);
}

const errores = [];
let total = 0;

for (const archivo of controladores(RAIZ)) {
  const fuente = readFileSync(archivo, 'utf8');
  const rutas = [...fuente.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/g)].map(
    (m) => ({
      metodo: m[1],
      texto: m[2] ?? '',
      segmentos: (m[2] ?? '').split('/').filter(Boolean),
    }),
  );
  total += rutas.length;

  for (let i = 0; i < rutas.length; i += 1) {
    for (let j = i + 1; j < rutas.length; j += 1) {
      const antes = rutas[i];
      const despues = rutas[j];
      if (antes.metodo !== despues.metodo) continue;
      // Solo importa cuando la de despues es mas concreta: si las dos tienen
      // parametro en el mismo sitio, son la misma ruta y eso lo dice Nest.
      // Si la de despues tambien lleva parametro en el mismo sitio, son la
      // misma ruta y de eso se queja Nest, no esto.
      if (despues.segmentos.some((seg) => seg.startsWith(':'))) continue;
      if (tapa(antes.segmentos, despues.segmentos)) {
        errores.push(
          `${archivo}: @${antes.metodo}('${antes.texto}') tapa a @${despues.metodo}('${despues.texto}'), ` +
            'declarada despues. Mueve la concreta ARRIBA de la que lleva parametro',
        );
      }
    }
  }
}

console.log(`Rutas revisadas: ${total}`);

if (errores.length) {
  console.error(`\n${errores.length} ruta(s) tapada(s):\n`);
  for (const e of errores) console.error(`  - ${e}`);
  console.error();
  process.exit(1);
}

console.log('OK — ninguna ruta queda tapada por otra declarada antes.');
