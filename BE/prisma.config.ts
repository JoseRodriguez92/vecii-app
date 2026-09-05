import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracion de Prisma (Prisma 7+).
 * Las URLs de conexion ya no van en schema.prisma.
 *
 * - DIRECT_URL: conexion directa a Postgres de Supabase (puerto 5432).
 *   Se usa para `prisma migrate` / `prisma db push` / introspeccion.
 * - DATABASE_URL: conexion via pooler de Supabase (puerto 6543), la usa
 *   el runtime de la app a traves del driver adapter (ver PrismaService).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
