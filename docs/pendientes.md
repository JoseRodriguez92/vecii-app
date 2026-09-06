# Pendientes

Todo lo que se decidió aplazar durante el diseño, con el motivo. Si algo aquí
ya no aplica, se borra — una lista que nadie poda deja de leerse.

Las tareas de implementación de cada decisión están en su ADR; aquí van las que
no tienen ADR propio.

---

## 🔴 Las migraciones no reflejan la base

`prisma/migrations/` tiene dos migraciones del 6 de septiembre a las 02:37 y
02:49. Describen `torres`, `membresias` y `ocupaciones_unidad` — nombres que ya
no existen — y ninguna de las 14 tablas que se agregaron después.

Todo el rediseño posterior se aplicó con `prisma db push`, que modifica la base
para que coincida con el schema **sin dejar archivo**. Fue lo correcto mientras
el modelo cambiaba cada media hora: cada `migrate dev` habría generado un `.sql`
que a los diez minutos era mentira. Pero el modelo ya está estable, y hoy quien
clone el repo y corra `prisma migrate deploy` levanta el esquema de las 02:49.

→ **Rehacer la línea base.** Borrar las dos migraciones, generar una sola con
`migrate diff` desde vacío contra el schema actual, y marcarla como aplicada con
`migrate resolve` (no ejecutarla: la base ya tiene esas tablas). Desde ahí, cada
cambio va por `migrate dev` y `db push` no se usa más.

Es también el único lugar donde pueden vivir las restricciones que Prisma no
sabe expresar y que están más abajo en este archivo: el `CHECK` de
`espacio_apunta_a_algo` y el índice único parcial de `unidades`. Hay que
agregarlas a mano al `.sql` de la línea base.

---

## 🔴 Antes de facturar a alguien de verdad

**`Unidad.coeficiente` tiene `@default(0)`**
`0` significa dos cosas a la vez: "no se ha cargado" y "es cero". Un cargue a
medias produce recibos en cero y nadie se entera hasta que no llega la plata.
→ Pasarlo a `Decimal?` y que el sistema se niegue a facturar si hay nulos.

**Nadie valida que los coeficientes sumen 100%**
Si suman 99.87%, el conjunto recauda menos de lo presupuestado todos los meses.
No se puede hacer con una restricción de base (cruza filas): va en el servicio,
y como chequeo de salud visible del conjunto.

**Falta el coeficiente sectorial**
Una unidad tiene participación en el conjunto (gastos generales) **y** en su
etapa (expensas sectoriales). Hoy solo cabe una. Sin la segunda no se puede
cobrar la piscina de la Etapa 1 solo a esa etapa.
Ver [`dominio/expensas-y-coeficientes.md`](dominio/expensas-y-coeficientes.md).

---

## 🟡 Modelo de datos

**Parqueadero pegado a un apartamento**
En Colombia se compra el apto 501 *y* el parqueadero 34, que es unidad privada
con coeficiente propio pero nunca se vende aparte. Hoy quedan sin relación: dos
recibos, y al vender hay que acordarse de cambiar el dueño del parqueadero.
→ `unidadPrincipalId` opcional en `Unidad`.

**Parqueadero: bien privado vs. bien común de uso exclusivo**
Son cosas legalmente distintas. El primero tiene matrícula y coeficiente; el
segundo es del conjunto, solo está asignado, y no paga aparte. Hoy solo se
representa el primero. Afecta directamente quién paga qué.

**`barrio` y `localidad` en `Conjunto`**
Para el marketplace, `ciudad = "Bogotá"` son ocho millones de personas. Las
coordenadas resuelven "a 5 km" pero no el filtro que la gente usa: "en mi
localidad". Ver [ADR-0006](adr/0006-visibilidad-marketplace.md).

**`EstadoConjunto` solo tiene `ACTIVO` y `SUSPENDIDO`**
Falta distinguir el ciclo de vida comercial de Vecii: en implementación (cargando
datos, todavía no factura), activo, suspendido, cancelado.

**`Tipologia.banos` es entero**
En Colombia se dice "2 baños y medio". Decidir si importa.

**Índice parcial para cerrar el hueco de unicidad**
`@@unique([conjuntoId, agrupacionId, identificador])` no impide dos "101" con
`agrupacionId` nulo, porque Postgres trata los NULL como distintos. Al pasar a
migraciones definitivas:
`CREATE UNIQUE INDEX ... ON unidades (conjunto_id, identificador) WHERE agrupacion_id IS NULL;`

---

## 🔴 Antes de abrir reservas al público

**Cupo de reservas concurrentes — esto NO se resuelve en código de aplicación**

Dos personas reservan el último cupo en el mismo instante. Las dos consultas
cuentan "hay 49 de 50 ocupados", las dos reciben que cabe, las dos insertan.
Resultado: 51 reservas para 50 cupos.

Validar en el servicio no lo arregla: entre el `count` y el `insert` hay una
ventana, y con concurrencia siempre se cuela.

Como los espacios tienen **capacidad** (el salón es 1, el pool de visitantes es
50), una restricción `EXCLUDE` de Postgres **no sirve** — esa solo sabe impedir
solapamientos, no contar. La forma correcta es un **advisory lock** por espacio
alrededor del conteo y la inserción, dentro de la misma transacción:

```sql
-- dentro de la transaccion, antes de contar:
SELECT pg_advisory_xact_lock(hashtextextended(:espacio_id, 0));
-- ahora contar solapadas y decidir; el lock se libera al hacer commit
```

Sirve igual para capacidad 1 y para capacidad 50, así que es un solo mecanismo.

**CHECK de espacio bien formado en `espacios_reservables`**
Un espacio apunta a una zona común **o** a un pool de parqueaderos, no a ambos
ni a ninguno:

```sql
ALTER TABLE espacios_reservables ADD CONSTRAINT espacio_apunta_a_algo
  CHECK ((zona_comun_id IS NULL) <> (naturaleza_parqueadero IS NULL));
```

**Capacidad vs. inventario real**
Si el pool de visitantes declara capacidad 50 pero solo hay 30 filas en
`parqueaderos` con naturaleza `VISITANTES`, hay una incoherencia. Vale un
chequeo de salud que la reporte (no una restricción: la capacidad puede ser
menor a propósito, reservando cupos para uso libre).

**Tarifas y depósitos** — esperan a finanzas. La reserva guarda el hecho
(espacio, franja); el cargo lo genera finanzas leyéndolo.

**Un `SORTEO` sobre un parqueadero `PRIVADO` debe rechazarse.** En los privados
solo tienen sentido `ESCRITURA`, `PRESTAMO` y `ARRIENDO`: rifar la propiedad de
alguien no es una opción.

---

## 🟡 Correos: SMTP propio, no el de Supabase

Hoy `SupabaseAdminService.invitarPorCorreo` usa `inviteUserByEmail`, que hace que
**Supabase mande el correo**. No es lo que queremos, y además su SMTP interno
está limitado a unos pocos envíos por hora — inservible para invitar a 200
residentes.

Cambiar a: generar el enlace sin enviar (`auth.admin.generateLink`) y mandarlo
desde nuestro propio SMTP.

Y hacerlo como un **módulo de notificaciones**, no metiendo SMTP dentro de
el registro de usuarios: en poco tiempo van a necesitar correo la cuota generada, la reserva
confirmada y el visitante en portería.

---

## 🟡 Validaciones del servicio

**Asignaciones de parqueadero: qué origen es válido para qué naturaleza.**
Hoy nada lo impide y son incoherencias que la base no puede ver, porque cruzan
la naturaleza del cupo con el origen del derecho. Va en el servicio cuando se
construya el módulo de parqueaderos:

| naturaleza | orígenes válidos | qué hay que rechazar |
|---|---|---|
| `PRIVADO` | `PROPIEDAD`, `PRESTAMO`, `ARRIENDO` | `SORTEO` y `REGLAMENTO`: un bien privado no se sortea ni lo reparte el reglamento |
| `USO_EXCLUSIVO` | `REGLAMENTO`, `PRESTAMO` | `PROPIEDAD`: no es de nadie |
| `ROTATIVO` | `SORTEO`, `PRESTAMO` | `PROPIEDAD` |
| `VISITANTES` | **ninguno** | cualquier asignación. Un cupo de visitantes no se asigna: se usa por turnos vía `espacios_reservables` |

Además: un `PRIVADO` sin `unidadId` en `parqueaderos` está a medio crear —le falta
la unidad que le da matrícula y coeficiente— y al revés, un cupo que no es
`PRIVADO` no debería tenerlo.

**`unidadId` significa cosas opuestas en dos tablas.** En `parqueaderos` el cupo
**es** esa unidad (solo `PRIVADO`); en `asignaciones_parqueadero` esa unidad
**usa** el cupo. Mismo nombre, relación invertida. Hoy se salva con el nombre de
la relación (`ParqueaderoEsUnidad`) y un comentario, pero un comentario no es un
nombre. Candidato: renombrar el de `parqueaderos`.


**Ciclos en la jerarquía de agrupaciones**
Nada impide hoy que A sea padre de B y B padre de A. Postgres lo acepta, y a
partir de ahí cualquier recorrido del árbol entra en bucle infinito.

**Profundidad máxima del árbol**
Estructuralmente es infinito; en la práctica tres niveles cubren todo. Poner tope
para que la interfaz no termine siendo un explorador de archivos.

**Unicidad del identificador cuando no hay agrupación**
La otra mitad del hueco del índice parcial.

---

## 🟡 API

**Filtro de excepciones de Prisma**
Hoy un error de llave foránea sale como **HTTP 500**, que es mentira: el servidor
está bien, el dato es el equivocado. Unas 40 líneas que sirven para todos los
módulos:

| Código | Debería ser |
|---|---|
| `P2002` | 409 — "Ya existe una unidad 101 en la Torre A" |
| `P2003` | 400 — "La agrupación no pertenece a este conjunto" |
| `P2025` | 404 — "No existe ese conjunto" |

**Custom Access Token Hook de Supabase**
Meter las membresías en el JWT para que la API deje de consultar Postgres en cada
petición. Es la tarea 1 del [ADR-0001](adr/0001-autenticacion-supabase.md).

---

## 🟡 Encomiendas: restricciones que Prisma no expresa

**Una encomienda no puede ir a una unidad Y a una agrupación al mismo tiempo.**
Los dos campos son opcionales para permitir los tres destinos (unidad / torre /
conjunto entero), pero llenar los dos es incoherente y hoy nada lo impide. Va en
el `.sql` de la línea base, junto a las otras:

```sql
ALTER TABLE encomiendas ADD CONSTRAINT entrega_destino_unico
  CHECK (NOT (unidad_id IS NOT NULL AND agrupacion_id IS NOT NULL));
```

**El casillero tiene que ser de la misma unidad a la que va la encomienda.** Hoy se
puede guardar el paquete del 501 en el casillero del 302 sin que nada chille.
Cruza tablas, así que no es un CHECK: va en el servicio.

---

## 🟢 Portería: lo que falta

`casilleros` y `encomiendas` ya están modelados; falta el API. Lo demás de portería
no se ha tocado:

- **Minuta de visitantes.** Ingreso y salida: nombre, documento, a qué unidad,
  quién autorizó, hora de entrada y de salida. Es la puerta de entrada al cobro
  del parqueadero de visitantes por minuto.
- **Autorización de salida de enseres.** Sin visto bueno del propietario o de la
  administración no sale una nevera. Tiene su propio flujo de aprobación.
- **El paquete que nadie retira.** No necesita estado propio —sale de
  `recibidaEn` + `estado`— pero sí una decisión: ¿a las cuántas semanas se
  devuelve, y quién decide? Eso es política del conjunto, no del código.
- **Domicilios de comida.** No generan encomienda: portería no los recibe. Cuando se
  modele la minuta hay que ver si el domiciliario entra ahí o no entra a ningún
  lado.

---

## 🟢 Herramientas del repo

**`scripts/verificar-vocabulario.mjs`** — hermano de `verificar-schema.mjs`, para que
la coherencia del vocabulario deje de depender de que alguien se acuerde. Falla si:

| Chequeo | Qué atrapa |
|---|---|
| toda tabla con `@@map` aparece en el glosario | la tabla nueva que nadie nombró |
| todo tag de Swagger termina en un nombre de tabla | el caso `personas`, automatizado |
| toda carpeta de `modules/` es prefijo de algún tag | el caso `seguridad`, automatizado |
| todo permiso empieza por un módulo que existe | permisos huérfanos |
| toda palabra del glosario sigue usándose | el glosario que acumula fósiles |

El último importa tanto como los otros: un glosario que solo crece se vuelve un
cementerio, y ahí deja de leerse.

Se cuelga de `pnpm lint`. Mismo espíritu que `PermisosService`, que se niega a
levantar la API si falta un permiso sembrado: no confiar en la memoria de nadie.

Verifica **cobertura, no criterio**: puede exigir que `visitas` tenga su fila en el
glosario, no decidir si `visitas` era mejor palabra que `minuta`.

- Podar las ~12 skills que no aplican a Vecii (`prisma-mongodb-upgrade`,
  `prisma-compute`, `prisma-postgres*`, `expo-app-clip`, `expo-brownfield`,
  `expo-dom`, `expo-web-to-native`, `expo-module`). Bajan el costo fijo de
  contexto casi a la mitad.
- Evaluar `nestjs-expert` (comunidad; ninguna de las candidatas cubre ESM)
- Escribir la skill de dominio de Vecii: ESM con `.js`, Vitest, `conjuntoId`,
  `x-conjunto-id`
- **Nada está commiteado todavía**
- Rotar la contraseña de la base de datos (quedó expuesta en una conversación)
