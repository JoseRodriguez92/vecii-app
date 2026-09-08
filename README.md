# Vecii

Plataforma de gestión de conjuntos residenciales (propiedad horizontal) para Colombia,
construida sobre la Ley 675 de 2001.

## Estructura

Monorepo con pnpm workspaces.

```
vecii/
├── apps/
│   ├── api/           API NestJS (ESM) · Prisma 7 · Postgres de Supabase
│   ├── vecii/         App Expo (Web · Android · iOS)
│   └── landing/       Next.js — marketing, novedades, manual de usuario
└── docs/
    ├── adr/           decisiones de arquitectura y por qué se tomaron
    ├── dominio/       glosario y conocimiento de propiedad horizontal
    ├── estado-actual.md
    └── pendientes.md
```

## Cómo funciona

- **Autenticación:** Supabase Auth emite el JWT; la API lo valida por JWKS. No hay
  servicio de auth propio.
- **La persona y la cuenta son cosas distintas.** Alguien puede estar registrado sin
  poder entrar a la app — el copropietario que no gestiona, el dueño que vive afuera,
  la empresa que compró el local. Se identifica por correo, documento o celular.
- **Autorización por PERMISO, no por rol.** El código pregunta por un permiso 27 veces
  y por un rol casi nunca, y por eso cada conjunto puede inventar sus propios cargos sin
  tocar una línea. La matriz se administra desde la interfaz.
- **Multi-tenant:** `conjuntoId` es el tenant, y el aislamiento no depende de que el
  código se porte bien: las llaves foráneas son **compuestas** —apuntan a la pareja
  (cosa, conjunto)— así que una unidad de un conjunto colgada de una torre de otro es
  imposible de escribir, venga del API, de un importador o de SQL a mano.
- **Datos:** Postgres de Supabase, accedido **solo** desde la API vía Prisma. Las 33
  tablas tienen RLS habilitado sin políticas, así que la API REST de Supabase no las
  expone: la puerta está cerrada con llave, no con portero.
- **Lo derivable se deriva.** Un saldo, un total, un "pagado" o un "reservable" no se
  guardan: se calculan. Guardar una conclusión al lado del hecho es garantizar que algún
  día se contradigan.

Los porqués están en [`docs/adr/`](docs/adr/) y el vocabulario en
[`docs/dominio/glosario.md`](docs/dominio/glosario.md). **Léelos antes de proponer un
cambio estructural** — es probable que ya se haya discutido.

## Puesta en marcha

Necesitas un proyecto en [Supabase](https://supabase.com) (gratis).

```bash
pnpm install                  # una sola vez, desde la raíz

cp apps/api/.env.example apps/api/.env
cp apps/vecii/.env.example apps/vecii/.env

pnpm db:deploy                # aplica las migraciones
pnpm db:generar               # genera el cliente de Prisma
pnpm db:seed                  # siembra módulos, permisos y roles

pnpm dev:api                  # http://localhost:3201/api  (Swagger en /docs)
pnpm dev:app                  # w = web, a = Android, i = iOS
pnpm dev:landing
```

El seed **no es opcional**: la API verifica al arrancar que todo permiso declarado en un
decorador exista sembrado, y se niega a levantar si falta uno.

> **No corras `npx prisma ...` desde la raíz.** Prisma vive en `apps/api/node_modules`, así
> que desde la raíz npx no lo encuentra, se va a npm y se baja la última versión publicada
> —hoy un release candidate de Prisma 8, donde los comandos ni se llaman igual—. Para eso
> están los scripts de arriba.

## Antes de commitear

```bash
cd apps/api
pnpm lint          # oxlint + los seis verificadores
npx tsc --noEmit
pnpm test
```

Los seis verificadores son propios y valen más de lo que parecen — entre todos han
atrapado relaciones sin inversa, tablas sin RLS, restricciones sin mensaje y rutas
tapadas, todo antes de llegar a producción:

| script | qué impide |
|---|---|
| `verificar-schema` | campos duplicados, relaciones sin inversa, tablas o columnas fuera de snake_case |
| `verificar-vocabulario` | que una misma cosa se llame distinto en la tabla, la carpeta, la ruta, el permiso y el tag de Swagger — y que reaparezca una palabra descartada |
| `verificar-rls` | que una tabla nueva quede expuesta por la API de Supabase |
| `verificar-rutas` | que `@Get(':id')` tape a `@Get('mias')` y el cliente reciba un 400 que no dice nada |
| `verificar-errores` | que una restricción de la base no tenga cómo explicarse en español |
| `verificar-cliente` | que el cliente de Prisma haya quedado viejo respecto al schema |

## Estado

**33 tablas, 26 rutas, 111 endpoints, 97 pruebas.** Todo con Swagger documentado.

- [x] Identidad y acceso — JWT por JWKS, persona separada de cuenta, staff de plataforma aparte
- [x] Permisos — RBAC administrable, cada conjunto crea sus propios cargos
- [x] La copropiedad — conjuntos, agrupaciones anidadas, tipologías, unidades con carga masiva
- [x] Los dos repartos — coeficiente de copropiedad y módulos de contribución por sector
- [x] Instalaciones — zonas comunes con horarios, parqueaderos y asignaciones
- [x] Reservas — espacios, políticas y reservas, con candado de concurrencia
- [x] Portería — casilleros, encomiendas, invitados, vehículos y bicicletas
- [x] Notificaciones — la campanita, con recordatorios programados
- [x] Cobranza — facturar el mes, emitirlo, registrar pagos y aplicarlos
- [x] Migraciones versionadas y RLS en las 33 tablas
- [ ] **La interfaz** — hoy los 111 endpoints solo se usan desde Swagger
- [ ] Pasarela de pagos — la interfaz está escrita, falta elegir proveedor
- [ ] Interés de mora
- [ ] Ingreso por OTP al celular
- [ ] Asambleas y votación por coeficiente
- [ ] Push y tiempo real (SSE)
- [ ] Control de ingreso en portería
- [ ] PQRS y cartelera
- [ ] Marketplace de saberes — diseñado en los ADR 0005 y 0006, sin construir
- [ ] CI/CD y despliegue

Las pruebas son todas de **dominio puro** — reglas que ninguna restricción de base puede
cuidar, sin base de datos ni mocks. La que más vale: el reparto de la cuota **suma
exactamente el monto**, porque multiplicar y redondear de a una deja el total corrido
unos pesos todos los meses.

Lo que falta, con el motivo de cada cosa, está en
[`docs/pendientes.md`](docs/pendientes.md). Dónde quedó todo, en
[`docs/estado-actual.md`](docs/estado-actual.md).

## Convenciones

- Gestor de paquetes: **pnpm**, siempre desde la raíz.
- La API es **ESM**: los imports relativos llevan extensión `.js`.
- Commits en español, en presente ("agrega", "corrige").
- **Cerrar, no borrar.** Casi nada se elimina: se le pone `hasta`. Hace falta para saber
  quién vivía en el 501 cuando se generó la cuota de enero.
- **Guardar el hecho, no la conclusión.** Un reparto masivo a una torre es *una* fila de
  encomienda, no ciento veinte.
- Las convenciones completas están en [`AGENTS.md`](AGENTS.md).
