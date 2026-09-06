# Vecii · Backend (API)

API REST para la gestión de conjuntos residenciales (propiedad horizontal, Colombia).

**Stack:** NestJS 12 (ESM) · Prisma 7 (driver adapter `pg`) · PostgreSQL de Supabase · Auth con JWT de Supabase.

## Requisitos

- Node 22+
- pnpm 11+
- Un proyecto en [Supabase](https://supabase.com)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env        # y completa los valores (ver abajo)
pnpm prisma:migrate         # crea las tablas en Supabase
pnpm prisma:seed            # datos de ejemplo (opcional)
pnpm start:dev              # http://localhost:3201/api  ·  docs: /docs
```

## Variables de entorno

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction** (pooler, `:6543`, con `?pgbouncer=true`) |
| `DIRECT_URL` | Igual pero **Session / direct** (`:5432`). La usan las migraciones |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Settings → JWT Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (solo backend) |
| `CORS_ORIGINS` | Orígenes del frontend separados por coma |

## Cómo funciona la autenticación

1. El frontend inicia sesión con **Supabase Auth** y obtiene un `access_token` (JWT).
2. Cada petición a la API lleva `Authorization: Bearer <token>`.
3. `SupabaseAuthGuard` (global) valida el JWT con `SUPABASE_JWT_SECRET`. Las rutas con `@Public()` se saltan la validación.
4. Para acciones dentro de un conjunto, el cliente envía la cabecera `x-conjunto-id`. `RolesGuard` carga la `Membresia` del usuario en ese conjunto y comprueba `@Roles(...)`.
5. `GET /api/auth/me` sincroniza el usuario de Supabase con la tabla `usuarios` y devuelve sus membresías.

> El JWT de Supabase se valida como **HS256** con el secreto compartido. Si tu proyecto usa claves asimétricas (ES256/RS256 vía JWKS), cambia `jwt.strategy.ts` para usar `jwks-rsa` contra `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.

## Estructura

```
prisma/
  schema.prisma         Modelos: Conjunto, Torre, Unidad, Usuario, Membresia, OcupacionUnidad
  seed.ts
prisma.config.ts        Config de Prisma 7 (URLs de conexión)
src/
  config/               Validación de variables de entorno
  prisma/               PrismaModule + PrismaService (driver adapter)
  auth/                 Estrategia JWT, guards (auth + roles)
  common/decorators/    @CurrentUser, @Roles, @Membresia, @Public
  health/               GET /api/health
  modules/
    conjuntos/          CRUD de conjuntos (ejemplo de módulo con tenant)
```

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm start:dev` | Servidor con recarga |
| `pnpm build` / `pnpm start:prod` | Build y ejecución de producción |
| `pnpm prisma:migrate` | `prisma migrate dev` |
| `pnpm prisma:generate` | Regenera el cliente Prisma |
| `pnpm prisma:studio` | Explorador visual de la BD |
| `pnpm prisma:seed` | Carga datos de ejemplo |
| `pnpm test` / `pnpm test:e2e` | Pruebas (vitest) |
| `pnpm lint` | oxlint |

## Añadir un módulo nuevo

```bash
pnpm exec nest g module modules/pagos
pnpm exec nest g controller modules/pagos
pnpm exec nest g service modules/pagos
```

Recuerda: imports relativos **con extensión `.js`** (proyecto ESM).
