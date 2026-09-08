# Decisiones de arquitectura (ADR)

Cada archivo registra **una** decisión: por qué se tomó, qué se descartó y qué consecuencias trae.

La idea no es documentar por documentar. Es que dentro de seis meses —cuando alguien pregunte
"¿y por qué no usamos microservicios?"— la respuesta esté escrita y no haya que re-discutirla
desde cero. Y cuando una decisión deje de servir, se escribe una nueva que la reemplace en vez
de editar la vieja: el historial de por qué cambiamos de opinión también vale.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-autenticacion-supabase.md) | La autenticación la hace Supabase, no nosotros | Aceptada |
| [0002](0002-monolito-modular.md) | Monolito modular, no microservicios | Aceptada |
| [0003](0003-monorepo.md) | Monorepo pnpm con `apps/` y `packages/` | Aceptada |
| [0004](0004-una-app-route-groups.md) | Una sola app Expo con route groups | Aceptada |
| [0005](0005-marketplace-saberes.md) | Marketplace de saberes entre residentes | Aceptada |
| [0006](0006-visibilidad-marketplace.md) | Qué del marketplace se ve sin iniciar sesión | Aceptada |
| [0007](0007-supabase-o-servidor-propio.md) | Supabase o servidor propio: los números y cuándo mudarse | Aceptada |

## Estados

- **Propuesta** — en discusión, todavía no se implementa
- **Aceptada** — es como trabajamos hoy
- **Reemplazada por ADR-XXXX** — ya no aplica; el reemplazo explica por qué

## Escribir una nueva

Numeración consecutiva, un archivo por decisión, y siempre con las opciones que se
descartaron. Un ADR sin alternativas es un comunicado, no una decisión.
