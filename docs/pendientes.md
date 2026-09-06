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
invitaciones: en poco tiempo van a necesitar correo la cuota generada, la reserva
confirmada y el visitante en portería.

---

## 🟡 Validaciones del servicio

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

## 🟢 Portería: sin modelar

Módulo entero pendiente. Lo que ya se sabe que va adentro:

**Casilleros.** Cada unidad tiene su casillero y ahí llegan recibos, paquetes y
compras. Ojo con la trampa: *el casillero y lo que llega adentro son dos cosas
distintas.*

| | qué es | cada cuánto cambia |
|---|---|---|
| **casillero** | el mueble, la casilla física con su número | casi nunca |
| **entrega** | el paquete que llegó hoy para el 501 | todo el día |

El casillero tiene la misma forma que un parqueadero de uso exclusivo: cosa
física + asignación a una unidad con vigencia. Se puede copiar ese patrón.

La entrega es lo que de verdad opera portería, y es la que tiene el ciclo:
llegó → quién la recibió → para qué unidad → avisar al residente → quién la
retiró y cuándo. Ese último dato es el que zanja el "yo nunca recibí nada".

**No todo conjunto tiene casilleros.** En muchos, portería guarda el paquete
detrás del mostrador y ya. Entonces el casillero es infraestructura OPCIONAL y
la entrega es lo universal: una entrega puede existir sin casillero, pero no al
revés.

Preguntas abiertas para cuando se arranque:
- ¿La entrega se registra contra la unidad o contra la persona? (La minuta de
  portería dice "apto 501", no un nombre — probablemente la unidad, igual que la
  deuda y las reservas.)
- ¿Hay casilleros que no sean de una unidad? (Correspondencia de la
  administración, del consejo.)
- ¿Qué pasa con un paquete que nadie retira en un mes?
- Visitantes, minuta de entradas y salidas, y el parqueadero de visitantes por
  minuto que ya se habló — todo eso también es portería y hay que ver si comparte
  tablas con las entregas o no.

---

## 🟢 Herramientas del repo

- Podar las ~12 skills que no aplican a Vecii (`prisma-mongodb-upgrade`,
  `prisma-compute`, `prisma-postgres*`, `expo-app-clip`, `expo-brownfield`,
  `expo-dom`, `expo-web-to-native`, `expo-module`). Bajan el costo fijo de
  contexto casi a la mitad.
- Evaluar `nestjs-expert` (comunidad; ninguna de las candidatas cubre ESM)
- Escribir la skill de dominio de Vecii: ESM con `.js`, Vitest, `conjuntoId`,
  `x-conjunto-id`
- **Nada está commiteado todavía**
- Rotar la contraseña de la base de datos (quedó expuesta en una conversación)
