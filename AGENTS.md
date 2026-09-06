# Vecii

> **Empezá por [`docs/estado-actual.md`](docs/estado-actual.md).** Dice dónde quedó
> el proyecto, qué comandos correr antes de tocar nada, y cuál es el hilo abierto.

Plataforma de gestión de conjuntos residenciales (propiedad horizontal) para
Colombia. Monorepo pnpm.

```
apps/api        NestJS (ESM) · Prisma 7 · Postgres de Supabase
apps/vecii      Expo 57 — app del conjunto y de portería
apps/landing    Next.js 16 — marketing y manual
packages/       código compartido
docs/adr/       decisiones de arquitectura, con el porqué
docs/dominio/   conocimiento del negocio
docs/pendientes.md
```

## Convenciones duras

- **pnpm siempre desde la raíz.** `pnpm dev:api`, `pnpm dev:app`, `pnpm db:push`.
- **La API es ESM**: los imports relativos llevan extensión `.js`.
- **Commits en español, en presente**: "agrega", "corrige".
- **Base de datos**: `pnpm db:push` mientras no haya datos reales; `pnpm
  prisma:migrate` a partir de que los haya. `db:push` regenera el cliente solo —
  nunca lo separes, o terminas compilando contra un cliente viejo.
- Las skills de `.claude/skills/` son oficiales de Expo, Prisma y Supabase. Se
  actualizan con `npx skills update`, no editándolas a mano.

## Lenguaje del dominio

Una palabra por concepto, la misma en el schema, el código, la interfaz y las
conversaciones. **Es obligatorio, no una sugerencia**: cuando el mismo concepto
tiene tres nombres, alguien termina modelando dos veces la misma cosa.

@docs/dominio/glosario.md

## Reglas de modelado que ya están decididas

- **Lo derivable se deriva, no se guarda.** La categoría de una unidad sale de su
  tipo; los roles de propietario y residente salen de las ocupaciones. Guardar la
  conclusión junto al hecho garantiza que algún día se contradigan.
- **Cerrar, no borrar.** Un derecho que termina se cierra con `hasta`; la fila se
  queda. El historial es el que responde en una asamblea.
- **Guardar el hecho, no la conclusión.** Los minutos usados, no el valor
  cobrado. Las tarifas cambian y los cobros se corrigen.
- **Rígido donde la ley es rígida, configurable donde manda el reglamento.** Los
  coeficientes reparten las expensas (Ley 675, no se discute); que un moroso
  pueda reservar lo decide cada conjunto, así que es configuración.

## Antes de proponer un cambio estructural

Lee `docs/adr/`. Es probable que ya se haya discutido y esté escrito por qué se
decidió así.

## Cómo se valida un diseño aquí

Antes de dar por buena una tabla, **escribe tres o cuatro filas de un conjunto
colombiano real** — con nombres, no con `foo` y `bar`. Es la prueba más barata
que existe y encuentra lo que ninguna revisión en abstracto encuentra: así
apareció que dos apartamentos "101" no cabían en el modelo, y que las etapas de
un conjunto a veces son conjuntos distintos.
