# Vecii

Plataforma de gestión de conjuntos residenciales (propiedad horizontal) para Colombia.

## Estructura

Monorepo con pnpm workspaces.

```
vecii/
├── apps/
│   ├── api/           API NestJS (ESM) · Prisma 7 · Postgres de Supabase
│   ├── vecii/         App Expo (Web · Android · iOS)
│   │                    (conjunto)  residentes, propietarios, consejo, administración
│   │                    (porteria)  porteros
│   └── landing/       Next.js — marketing, novedades, manual de usuario
├── packages/          código compartido (contracts, tokens, auth, ui-native)
└── docs/adr/          decisiones de arquitectura y por qué se tomaron
```

## Cómo funciona

- **Autenticación:** Supabase Auth emite el JWT. La API lo valida; no hay servicio de auth propio.
- **Autorización:** la API resuelve el rol del usuario en cada conjunto.
- **Datos:** Postgres de Supabase, accedido solo desde la API vía Prisma. Las apps nunca hablan directo con la BD.
- **Multi-tenant:** los datos del conjunto se aíslan por `conjuntoId`; el rol vive en `Membresia`.

Los porqués están en [`docs/adr/`](docs/adr/). **Léelos antes de proponer un cambio estructural** — es probable que ya se haya discutido.

## Puesta en marcha

Necesitas un proyecto en [Supabase](https://supabase.com) (gratis).

```bash
pnpm install                  # una sola vez, desde la raíz

cp apps/api/.env.example apps/api/.env
cp apps/vecii/.env.example apps/vecii/.env
cp apps/landing/.env.example apps/landing/.env   # si aplica

pnpm prisma:migrate           # crea las tablas en Supabase

pnpm dev:api                  # http://localhost:3000/api  (docs: /docs)
pnpm dev:app                  # w = web, a = Android, i = iOS
pnpm dev:landing              # http://localhost:3000
```

Cada carpeta bajo `apps/` tiene su propio README con el detalle.

## Estado

- [x] Monorepo, decisiones de arquitectura escritas
- [x] API: NestJS + Prisma + Supabase, guards de auth y roles, módulo `conjuntos`, `/health`, Swagger
- [x] App: Expo Router, Supabase Auth, cliente de API, login → área protegida
- [x] Modelo base: `Conjunto`, `Torre`, `Unidad`, `Usuario`, `Membresia`, `OcupacionUnidad`
- [ ] Primera migración corrida contra Supabase
- [ ] Route groups `(conjunto)` y `(porteria)`
- [ ] Módulos de negocio: unidades, cuotas, pagos, reservas, PQRS, cartelera, visitantes, asambleas
- [ ] Marketplace de saberes (modelado, no construido — ver ADR-0005)
- [ ] Row Level Security en Supabase
- [ ] CI/CD y despliegue

## Convenciones

- Gestor de paquetes: **pnpm**, siempre desde la raíz.
- La API es **ESM**: los imports relativos llevan extensión `.js`.
- Commits en español, en presente ("agrega", "corrige").
- Las skills en `.claude/skills/` son oficiales de Expo, Prisma y Supabase. Se actualizan con
  `npx skills update`, no editándolas a mano.
