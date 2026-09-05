# Vecii

Plataforma de gestión de conjuntos residenciales (propiedad horizontal) para Colombia.

## Arquitectura

```
Vecii App/
├── FE/   App Expo (Web · Android · iOS)  — React Native + Expo Router
├── BE/   API NestJS (ESM)                — Prisma 7 + PostgreSQL
└──       Base de datos y Auth            — Supabase
```

- **Autenticación:** Supabase Auth emite el JWT. El frontend inicia sesión con el SDK de Supabase; el backend valida ese JWT en cada petición.
- **Datos:** Postgres de Supabase, accedido solo desde el backend vía Prisma. La app nunca habla directo con la BD.
- **Multi-tenant:** cada conjunto residencial aísla sus datos por `conjuntoId`; el rol del usuario en cada conjunto se guarda en `Membresia`.

## Puesta en marcha rápida

Necesitas un proyecto en [Supabase](https://supabase.com) (gratis).

```bash
# 1. Backend
cd BE
pnpm install
cp .env.example .env          # completa DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_JWT_SECRET
pnpm prisma:migrate
pnpm start:dev                 # http://localhost:3000/api  (docs: /docs)

# 2. Frontend (otra terminal)
cd FE
pnpm install
cp .env.example .env          # completa EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL
pnpm start                    # w = web, a = Android, i = iOS
```

Cada carpeta tiene su propio README con el detalle.

## Estado

Scaffold inicial:

- [x] Estructura del monorepo + git
- [x] Backend: NestJS + Prisma + Supabase, guard de auth, guard de roles, módulo `conjuntos`, `/health`, Swagger
- [x] Frontend: Expo Router, Supabase Auth, cliente de API, flujo login → área protegida
- [x] Modelo de datos base: `Conjunto`, `Torre`, `Unidad`, `Usuario`, `Membresia`, `OcupacionUnidad`
- [ ] Módulos de negocio: unidades, cuotas de administración, pagos, reservas de zonas comunes, PQRS, cartelera, visitantes, asambleas
- [ ] Pasarela de pagos (Wompi / PayU / Mercado Pago — por definir)
- [ ] Row Level Security en Supabase / políticas de acceso
- [ ] CI/CD y despliegue

## Convenciones

- Gestor de paquetes: **pnpm** en ambos proyectos.
- Backend en **ESM**: los imports relativos llevan extensión `.js`.
- Commits: en español, presente ("agrega", "corrige").
