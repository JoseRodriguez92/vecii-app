# Pendientes

Todo lo que se decidió aplazar durante el diseño, con el motivo. Si algo aquí
ya no aplica, se borra — una lista que nadie poda deja de leerse.

Las tareas de implementación de cada decisión están en su ADR; aquí van las que
no tienen ADR propio.

---

## 🟡 Suplantar a un usuario para ver su interfaz

Que el equipo de Vecii pueda mirar la app como la ve un residente del 501, para
soportar sin pedirle capturas. Es útil de verdad y es delicado: tiene que quedar
auditado —quién suplantó a quién y cuándo— y probablemente limitado a
`STAFF_VECII`, con la sesión marcada para que nada quede a nombre del suplantado.

---

## 🔴 Antes de facturar a alguien de verdad

**Nadie se niega a facturar una unidad sin coeficiente**
La mitad ya está: la columna pasó de `@default(0)` a `Decimal?`, así que `null`
ya significa "no se ha cargado" y no se confunde con un cero de verdad. Falta la
otra mitad, y es de finanzas: negarse a generar la cuota si algún coeficiente del
conjunto está en null. Sin eso, un cargue a medias produce recibos en cero y
nadie se entera hasta que no llega la plata.

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

---

## 🟡 Reservas: lo que quedó fuera

**El candado de concurrencia ya está puesto.** `ReservasService.crear` toma un
`pg_advisory_xact_lock` por espacio antes de contar las solapadas, dentro de la
misma transacción que inserta. Es un lock de transacción, así que se suelta solo
al terminar y funciona igual detrás del pooler de Supabase. Serializa únicamente
las reservas del mismo espacio.

Lo que sigue pendiente de este módulo:

- **La reserva abierta que nadie cierra.** Sin `fin`, el cupo queda tomado para
  siempre y la cuenta de esa unidad crece sola. Hace falta cerrarlas: una tarea
  que las corte a las `duracionMaximaMinutos` de la política, o al menos una
  alerta de "abiertas hace más de 12 horas". Hoy solo existe el filtro
  `GET /reservas?abiertas=true`, que depende de que alguien lo mire.
- **`bloqueaConMora` se guarda pero no bloquea.** Necesita la consulta de mora,
  que es de finanzas.
- **Nadie marca `CUMPLIDA`.** Una reserva confirmada que pasó se queda en
  `CONFIRMADA` para siempre. Falta una tarea que las cierre, o derivarlo de la
  fecha y no guardar ese estado.
- **Los parqueaderos no tienen API.** Las zonas comunes ya la tienen (modulo
  `instalaciones`); `parqueaderos` y `asignaciones_parqueadero` siguen cargandose a
  mano. Sin eso, `POST /reservas/:id/cupo` no tiene que asignar.
- **Una reserva que cruza la medianoche** se rechaza cuando el espacio tiene
  horario: hay que partirla en dos. Si aparece el caso de verdad —una fiesta que
  termina a las 2am— toca validar contra dos franjas.

---

## 🟡 El tiempo real, y por qué no lo hace Supabase

Las 25 tablas tienen RLS habilitado **sin ninguna política**, así que la API REST
de Supabase no las expone: la puerta está cerrada con llave, no con portero. Eso
cierra un hueco que se abría solo el día del primer build —la llave publicable es
pública por diseño y viaja dentro de la app— y lo cuida `verificar-rls.mjs`, que
falla si aparece una tabla sin RLS.

**La consecuencia asumida:** Supabase Realtime deja de servir directo al cliente,
porque quien decide qué ve cada quien ahí es RLS. La alternativa habría sido
escribir unas cien políticas —25 tablas por `SELECT`/`INSERT`/`UPDATE`/`DELETE`—
replicando en SQL los 27 permisos y la matriz de roles. Dos sistemas de
autorización que hay que mantener de acuerdo para siempre, que es el problema de
`reservable` pero en el peor lugar posible.

Así que el tiempo real se construye en Nest, donde el guard ya resuelve conjunto,
roles y permisos. Y ahí la decisión es **SSE**, no WebSocket:

- Todo lo que Vecii necesita empujar va en **una sola dirección** — llegó tu
  encomienda, autorizaron un invitado, te confirmaron la reserva. Lo que el
  usuario hace va por la API REST normal.
- SSE es HTTP puro: **el mismo Bearer y el mismo guard**, reconexión automática
  del protocolo, y Nest lo trae de fábrica con `@Sse()`. Autenticar un WebSocket
  es un problema aparte, porque el handshake no lleva headers con facilidad.
- El costo: **React Native no trae `EventSource`** —"Can't find variable:
  EventSource"— así que el cliente necesita `react-native-sse`. Cuatro kilobytes
  contra resolver la autenticación de un socket a mano.

## 🔴 El ingreso de verdad: OTP al celular

Hoy se entra con correo y contraseña, y eso deja por fuera a media Colombia: todo
el mundo tiene celular y contesta WhatsApp; el correo mucha gente ni lo abre. El
ingreso va a ser **las dos puertas** — correo con contraseña, o celular con un
código— sobre **una sola cuenta**.

Tres cosas hay que resolver, y en este orden:

**1. El proveedor.** Supabase no manda SMS por su cuenta: hay que conectar
Twilio, MessageBird, Vonage o TextLocal. **WhatsApp solo funciona a través de
Twilio.** Vale la pena mirarlo antes que SMS: en Colombia sale más barato y la
gente lo lee. Tiene costo por mensaje en cada ingreso.

**2. Las dos puertas tienen que vivir en la MISMA cuenta de Supabase.** Hoy
`crearCuenta` solo le pone el correo. Si la persona después entra por OTP con su
celular, ese número no está en ninguna cuenta y Supabase le crearía una nueva con
otro `sub` — o sea la misma persona dos veces, cada una con sus unidades a
medias. Al registrar hay que ponerle el celular a esa misma cuenta.
**Confirmarlo en un ambiente de prueba antes de creerlo**: la documentación no
dice qué pasa con un teléfono que no está en ningún usuario.

**3. El documento como segundo factor en el primer ingreso.** El OTP prueba que
quien entra controla ese número; **no** prueba que el administrador lo tecleó
bien. Si se equivocó en un dígito, el código llega al número de otra persona y
funciona perfecto. Contra eso: después del OTP, pedirle el número de documento y
enlazar solo si coincide. Dos factores independientes —el celular prueba
posesión, el documento prueba identidad— y quien se equivocó tecleando no puede
acertar los dos.

Mientras tanto el guard ya enlaza por teléfono verificado
(`SupabaseAuthGuard.personaDeLaCuenta`), y se abstiene si hay dos personas
anotadas con el mismo número.

---

## 🟡 Correos: SMTP propio, no el de Supabase

La mitad ya está: `SupabaseAdminService.crearCuenta` usa `auth.admin.generateLink`,
que crea la cuenta y **devuelve el enlace sin mandar nada**. Se cambió porque
`inviteUserByEmail` hacía que el correo lo mandara Supabase, con un SMTP interno
limitado a unos pocos envíos por hora — inservible para invitar a 200 residentes.

Falta la otra mitad: **nadie manda ese enlace**. Hoy los usuarios entran por
"olvidé mi contraseña". Hace falta el SMTP propio.

Y hacerlo como un **módulo de notificaciones**, no metiendo SMTP dentro de
el registro de usuarios: en poco tiempo van a necesitar correo la cuota generada, la reserva
confirmada y el visitante en portería.

---

## 🟡 Validaciones del servicio

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

## 🟡 Restricciones que Prisma no expresa

Las cinco que sí caben en la base ya están puestas, en la migración
`20260907010000_restricciones`: el índice parcial de `unidades`, el destino único
de `encomiendas`, el `espacio_apunta_a_algo`, y las dos de `roles`.

Lo que queda es lo que **cruza tablas**, y por eso no puede ser un CHECK:

**El casillero tiene que ser de la misma unidad a la que va la encomienda.** Hoy se
puede guardar el paquete del 501 en el casillero del 302 sin que nada chille. Va
en el servicio.

---

## 🟡 Control de ingreso: el cupo reservado que se pierde

Hoy el sistema sabe cuántos cupos de visitantes están **reservados**, pero no
cuántos están **ocupados**. El portero deja entrar a alguien sin reserva, el
sistema ni se entera, y cuando llega el invitado que sí reservó no hay puesto.
La reserva del pool promete "un cupo" y esa promesa solo se cumple si alguien
respeta la cuenta en la puerta.

Tres niveles, y el del medio no necesita hardware:

| | qué es | qué resuelve |
|---|---|---|
| **0** — hoy | pantalla de porterías con las reservas vigentes; el portero cuenta con los ojos | sirve si el parqueadero rara vez se llena |
| **1** | un botón: al entrar un carro, portería toca "asignar cupo" | ocupación real, hora de entrada, y el cupo deja de perderse |
| **2** | lector de placas o pantalla de reconocimiento | automatiza el nivel 1, no agrega nada conceptual |

El nivel 1 es una tabla chica —invitado, cupo, entrada, salida— y tres segundos
por carro, los mismos que hoy se gastan en la minuta de papel. Desbloquea dos
cosas que están trancadas:

- **Cobrar por estadía real** y no solo por la ventana reservada.
- **Cobrarle al que llega sin avisar**, que hoy no paga nada porque no hay de
  dónde sacar el tiempo.

Mientras no exista, el cobro del parqueadero de visitantes solo puede calcularse
sobre la reserva: reservó de 3 a 9 → seis horas, se haya ido a las 5 o a las 11.

---

## 🟢 Portería: lo que falta

`casilleros` y `encomiendas` ya están modelados; falta el API. Lo demás de portería
no se ha tocado:

- **Control de ingreso.** Ver el punto amarillo de arriba. La parte de "quién
  está autorizado" ya está resuelta en `invitados`; falta registrar cada entrada
  y salida.
- **Autorización de salida de enseres.** Sin visto bueno del propietario o de la
  administración no sale una nevera. Tiene su propio flujo de aprobación.
- **El paquete que nadie retira.** No necesita estado propio —sale de
  `recibidaEn` + `estado`— pero sí una decisión: ¿a las cuántas semanas se
  devuelve, y quién decide? Eso es política del conjunto, no del código.
- **Domicilios de comida.** No generan encomienda: portería no los recibe. Cuando se
  modele la minuta hay que ver si el domiciliario entra ahí o no entra a ningún
  lado.

---

## 🟡 La base está mitad snake_case y mitad camelCase

Las **tablas** están en snake_case porque todas llevan `@@map(...)`. A las
**columnas** nunca les pusimos `@map`, así que quedaron con el nombre de
TypeScript: `conjuntoId`, `numeroDocumento`, `agrupacionId`.

No rompe nada —Prisma traduce solo— pero cobra en cada SQL a mano y en DBeaver:
toda columna con mayúscula necesita comillas dobles, y sin ellas Postgres la pasa
a minúsculas y responde que no existe.

Son ~150 columnas en 23 modelos: mecánico, pero cambia la base entera. Ya no
depende de nada: es agregar `@map` a cada columna y dejar que `migrate dev`
escriba los `ALTER TABLE ... RENAME COLUMN`. Conviene hacerlo **antes** de que
haya datos de clientes reales, porque es una migración larga.

---

## 🟢 Herramientas del repo

- Podar las ~12 skills que no aplican a Vecii (`prisma-mongodb-upgrade`,
  `prisma-compute`, `prisma-postgres*`, `expo-app-clip`, `expo-brownfield`,
  `expo-dom`, `expo-web-to-native`, `expo-module`). Bajan el costo fijo de
  contexto casi a la mitad.
- Evaluar `nestjs-expert` (comunidad; ninguna de las candidatas cubre ESM)
- **No subir a Prisma 8 todavía.** El CLI muestra un aviso de "update available
  7.10.0 -> 8.0.0-rc.13" cada vez que se corre, pero eso es un *release
  candidate*, no una versión estable, y es un cambio de versión mayor: entre
  otras cosas renombra `migrate` a `migration`. Revisarlo cuando salga el 8.0.0
  final, y con las migraciones ya en verde el cambio es barato.
- Escribir la skill de dominio de Vecii: ESM con `.js`, Vitest, `conjuntoId`,
  `x-conjunto-id`
