#!/usr/bin/env node
/**
 * Avisa si el cliente de Prisma quedo viejo respecto al schema.
 *
 * Existe porque este error se descubre siempre de la peor forma: corriendo el
 * seed o levantando la API, y leyendo un "Unknown argument `ambito`" que no dice
 * que lo que falta es un `db:push`.
 *
 * Ni verificar-schema ni verificar-vocabulario lo miran: los dos leen el schema,
 * y el schema esta bien. Lo que esta viejo es lo generado.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const schema = join(RAIZ, 'prisma/schema.prisma');
const cliente = join(RAIZ, 'src/generated/prisma/client.ts');

let generado;
try {
  generado = statSync(cliente).mtimeMs;
} catch {
  console.error('No hay cliente de Prisma generado.\n\n  Corre: pnpm db:push\n');
  process.exit(1);
}

const delSchema = statSync(schema).mtimeMs;

if (delSchema > generado) {
  const minutos = Math.round((delSchema - generado) / 60000);
  console.error(
    `El schema cambio despues de generarse el cliente (hace ~${minutos} min).\n\n` +
      '  Corre: pnpm db:push\n\n' +
      'Sin eso el seed y la API fallan con "Unknown argument", que no dice que falta esto.\n',
  );
  process.exit(1);
}

console.log('OK — el cliente de Prisma esta al dia con el schema.');
