# ADR-0007: Nos quedamos en Supabase, y mantenemos la salida barata

**Estado:** Aceptada
**Fecha:** 2026-09-08
**Deciders:** Web Team

## Contexto

Surgió la pregunta de si conviene mover Vecii a un servidor propio con Postgres
(Hetzner, DigitalOcean) en vez de seguir en Supabase. El argumento: *"prefiero
pagar un costo fijo y no uno que crece"*.

Es una preocupación legítima. Además apareció una segunda, más de fondo: si a
Vecii le pagan los conjuntos con dinero de las expensas, y hay residentes que no
pagan expensas, un costo que crece por usuario es un riesgo de margen.

Este ADR deja los números, porque en esta conversación es muy fácil discutir con
intuiciones y llegar a la respuesta equivocada.

## Los números (septiembre de 2026)

**Supuestos:** conjunto promedio de 200 unidades → ~500 personas en el registro,
de las cuales ~60% piden acceso (300 cuentas), y ~85% de esas generan un evento
de autenticación al mes → **~250 MAU por conjunto**. Sin fotos.

| conjuntos | MAU | plan+compute | MAU $ | egress | **total/mes** | **por conjunto** |
|---|---|---|---|---|---|---|
| 1 | 250 | $25 | $0 | $0 | **$25** | $25,00 |
| 10 | 2.500 | $25 | $0 | $0 | **$25** | $2,50 |
| 50 | 12.500 | $30 | $0 | $0 | **$30** | $0,60 |
| 100 | 25.000 | $30 | $0 | $0 | **$30** | $0,30 |
| 200 | 50.000 | $75 | $0 | $0 | **$75** | $0,38 |
| 300 | 75.000 | $75 | $0 | $0 | **$75** | **$0,25** |
| 400 | 100.000 | $125 | $0 | $0 | **$125** | $0,31 |
| 500 | 125.000 | $125 | $81 | $0 | **$206** | $0,41 |
| 700 | 175.000 | $125 | $244 | $9 | **$378** | $0,54 |
| 1000 | 250.000 | $225 | $488 | $23 | **$736** | $0,74 |

Dos cosas que no son obvias y que cambian la discusión:

1. **Lo caro es el piso, no el crecimiento.** Con un conjunto pagás $25 por
   conjunto; con 300 pagás $0,25. El punto más barato está cerca de los 300.
2. **El salto entre 300 y 500 es un escalón, no una pendiente.** Pasan dos cosas
   juntas: se cruzan los 100.000 MAU incluidos, y el compute sube de Medium a
   Large.

Cuidado con el costo **marginal**: lo que agrega *un conjunto más* cuando ya hay
mil (~$1) NO es lo que cuesta un conjunto. Lo que se paga es la factura completa
dividida entre los conjuntos que haya.

## Decisión

**Nos quedamos en Supabase.** No porque sea más barato a escala —no lo es— sino
porque hoy el ahorro es cero y el costo de esperar también.

La diferencia con la migración a snake_case, donde sí decidimos hacerlo ya: allá
esperarse se ponía caro (122 columnas, toda la base, imposible con datos de
clientes). **Aquí esperarse no se pone más caro.** Salir cuesta lo mismo en el
año 3 que hoy.

Y hay dos cosas que cambian con el tiempo en contra de autohospedar hoy: hoy hay
tiempo y no plata, en el año 3 será al revés; y hoy el equipo es una persona, que
es el peor momento para volverse responsable de una base de datos en producción.

## Las palancas, en orden

Cuando la factura pese, no se migra todo. Se tiran palancas, de la más barata a
la más cara:

| # | palanca | qué baja | costo |
|---|---|---|---|
| 1 | Paginar toda lista | egress | ya está en pendientes |
| 2 | Podar notificaciones viejas | disco | media hora |
| 3 | No crear cuenta a quien no la usa | MAU | ya está en el diseño |
| 4 | **Auth propio (GoTrue, MIT)** | **~66% de la factura** | un servidor de ~$15 |
| 5 | Base propia | el resto | backups, réplica, guardias |

**La 4 es la importante**, y es contraintuitiva: dos tercios de la factura a
escala son MAU, o sea Auth — no la base. Y Auth es lo barato de operar, porque
solo se toca al iniciar sesión: la API verifica el JWT sola contra el JWKS. Un
servidor chico atiende cientos de miles de usuarios.

| conjuntos | todo en Supabase | con Auth propio | diferencia |
|---|---|---|---|
| 300 | $75 | $90 | −$15 |
| ~450 | ~$165 | ~$155 | **empate** |
| 500 | $206 | $140 | +$66 |
| 1000 | $736 | $263 | **+$473** |

El punto de equilibrio de la palanca 4 cae justo en el escalón. Después de
tirarla, la curva se aplana: de 500 a 1000 conjuntos la factura sube $123.

**La 5 puede que nunca haga falta.** Bajaría de ~$263 a ~$160 al mes a cambio de
volverse responsable de la base de datos de mil copropiedades. A esa altura ya no
es una decisión de plata.

## Disparador para volver a mirar esto

Cuando la factura mensual pase de **~$300**, o al llegar a **~450 conjuntos**.
Antes de eso, no hay nada que decidir.

## Lo que hay que cuidar mientras tanto

El amarre a Supabase hoy es pequeño y hay que mantenerlo así:

| pieza | acoplamiento |
|---|---|
| Base de datos | ninguno. Prisma con `adapter-pg` habla Postgres estándar |
| Verificación del JWT | `jose` contra un endpoint JWKS — estándar IETF |
| Crear cuentas, `generateLink` | **un archivo**: `supabase-admin.service.ts`, 114 líneas |
| Storage, Realtime, Edge Functions | **no se usan** |

Reglas para que no crezca:

- **Nada fuera de `src/auth/` importa `@supabase/supabase-js`.**
- No usar funciones de la base propias de Supabase (`pg_notify` de su realtime,
  lógica en la base).
- El tiempo real se hace con **SSE desde Nest**, no con Supabase Realtime
  (decidido antes por otras razones; también nos mantiene portables).

Sobre el riesgo de que Supabase cambie la licencia: Supabase Auth es **MIT**, y
una licencia permisiva ya otorgada no se revoca para el código que ya existe.
El precedente está probado tres veces —Elasticsearch → OpenSearch, Redis →
Valkey, Terraform → OpenTofu—: aparece un fork mantenido en semanas. Y lo que de
verdad protege es que los datos están en Postgres plano: un `pg_dump` los saca
completos.

## Las fotos van aparte, y esa decisión vale más que esta

`Encomienda.fotoUrl` es un texto: la base guarda la dirección, no el archivo.
Cuando portería empiece a fotografiar paquetes, **esas fotos NO van a Supabase
Storage**.

Con 2 millones de encomiendas al año a 200 KB son 400 GB guardados, y cada vez
que alguien abre el aviso es egress facturado.

| proveedor | guardar 400 GB | servirlas | al mes |
|---|---|---|---|
| **Cloudflare R2** | $6,00 | **$0 (egress gratis)** | **$6** |
| Backblaze B2 | $2,78 | gratis hasta 3× lo guardado | $3 |
| AWS S3 | $9,20 | $6,03 | $15 |
| Supabase Storage | incluido | cuenta como egress | ~$12 |

**Cloudflare R2**, por el egress en cero: el costo crece con lo que se guarda, no
con cuántas veces se mira. Los otros se mueven con el uso, que es justo la
variable que no se controla. Además R2 habla la API de S3, así que cambiar de ahí
también es barato.

## Riesgo de cartera: dónde está de verdad

La preocupación de fondo —"si un conjunto no paga, igual me cuesta"— es correcta
en estructura pero está mal ubicada. Un conjunto moroso cuesta menos de $2 al mes
en infraestructura y puede deber $180 de facturas. **La plata no se pierde por el
servidor, se pierde por la cobranza.**

Lo que protege el margen no es el hosting:

1. **El cliente es la copropiedad** (persona jurídica con NIT), no los
   residentes. Los morosos son problema del administrador, que tiene mecanismos
   legales. *(Confirmar con abogado.)*
2. **Suspender rápido.** `EstadoConjunto.SUSPENDIDO` ya existe —el comentario del
   schema dice "normalmente por cartera"— pero **nadie lo verifica**: hoy un
   conjunto suspendido sigue funcionando. Ver `pendientes.md`.
3. **Cobrar por unidad**, no por usuario activo, para que ingreso y costo se
   muevan juntos.

## Fuentes

- [Supabase Pricing](https://supabase.com/pricing)
- [Compute and Disk — Supabase Docs](https://supabase.com/docs/guides/platform/compute-and-disk)
- [MAU: qué cuenta — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs)
  (un refresco de token cuenta como actividad, no solo el login)
- [supabase/auth — licencia MIT](https://github.com/supabase/auth)
- [Hetzner: comparación de servidores 2026](https://www.achromatic.dev/blog/hetzner-server-comparison)
- [R2 vs S3 vs B2 2026](https://tech-insider.org/cloudflare-r2-vs-s3-vs-backblaze-b2-2026/)
