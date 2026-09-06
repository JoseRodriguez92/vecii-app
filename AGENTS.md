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

### Cuándo se toca el glosario

En el **mismo cambio**, nunca "después":

- **Nace una tabla, un enum o un módulo** → su palabra entra al glosario antes
  del commit.
- **Se renombra algo** → se renombra en las cinco capas (tabla, carpeta, ruta,
  permiso, tag de Swagger) *y* en el glosario.
- **Aparece una palabra nueva discutiendo el dominio** → o entra al glosario, o
  se descarta a propósito y queda escrito por qué.
- **Un doc viejo contradice al glosario** → gana el glosario, y el doc se corrige
  en el acto.

Un ADR o un comentario escrito *antes* que el glosario no está exento: está
desactualizado. Así sobrevivió `seguridad/` dibujado en el ADR-0002 —un módulo
que en este proyecto se llama `porteria`— hasta que alguien fue a compararlos.

### Revisión de coherencia

Cada cierto tiempo, y siempre antes de cerrar una tanda de trabajo, se compara el
glosario contra lo que ya está escrito: tablas sin palabra, palabras que ya nadie
usa, docs que dicen otra cosa, módulos que no corresponden a ningún tag.

Se pide con estas palabras: **"revisemos el glosario"**. Y si vas a leer este
archivo, ofrecela vos cuando la tanda esté por cerrarse — no esperes a que la
pidan.

Hoy es una revisión que se hace leyendo. Cuando exista
`verificar-vocabulario.mjs` (ver [pendientes](docs/pendientes.md)) dejará de
depender de que alguien se acuerde.

### Dónde vive cada cosa

Son cinco lugares, y confundirlos es exactamente como la misma idea termina
escrita en dos:

| Qué | Dónde |
|---|---|
| el **porqué** de un campo o una tabla | comentario en `schema.prisma` |
| la **palabra** | `docs/dominio/glosario.md` |
| una **decisión estructural**, con lo que se descartó | `docs/adr/` |
| lo que se **aplazó**, con el motivo | `docs/pendientes.md` |
| dónde **quedamos** y cuál es el hilo abierto | `docs/estado-actual.md` |

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
