# Pendientes

Todo lo que se decidió aplazar durante el diseño, con el motivo. Si algo aquí
ya no aplica, se borra — una lista que nadie poda deja de leerse.

Las tareas de implementación de cada decisión están en su ADR; aquí van las que
no tienen ADR propio.

---

## Lo que queda del backend

Ordenado por cuánto duele al construir pantallas. Nada de esto es un módulo
nuevo: son huecos que solo se ven cuando alguien va a construir encima.

*(De los siete que encontró la auditoría del 7 de septiembre se cerraron seis.
Lo que se cerró está en "Decisiones recientes" de
[`estado-actual.md`](estado-actual.md); acá solo va lo que falta.)*

### 1. Ninguna lista pagina

En todo `src/` hay **un solo `take`**, y es el de notificaciones (50, tope 100).
Todo lo demás devuelve la tabla entera:

- `GET /usuarios` es el peor: trae los vínculos de todo el conjunto con sus roles
  anidados **y** una segunda consulta con todas sus ocupaciones. En un conjunto
  de 400 unidades son ~600 personas en un solo JSON.
- `GET /encomiendas` crece para siempre: nada las poda.
- `GET /unidades`, `GET /invitados`, `GET /reservas`, igual.

En un celular con datos eso no es lento: es la pantalla congelada.

### 2. Faltan los detalles por id

`usuarios`, `vehiculos`, `bicicletas`, `casilleros`, `tipologias` y
`espacios-reservables` no tienen `GET /:id`. Ninguno lo necesita para la
campanita —esos tres ya están— pero sí para cualquier pantalla de detalle.
Cualquier pantalla de detalle hoy tendría que traer la lista completa y filtrar
en el cliente.

### 3. No se puede buscar

`GET /vehiculos?placa=` sí busca por coincidencia parcial, y está bien pensado
—en la puerta se alcanzan a leer tres letras—. Pero no hay forma de buscar una
**unidad** por identificador ni una **persona** por nombre o documento. Con las
listas sin paginar, la app tendría que traerlo todo y filtrar en memoria.

## Decisiones abiertas

No son trabajo pendiente: son cosas que hay que decidir, y decidirlas mal
cuesta más que tardarse.

### 4. Elegir pasarela de pagos

**Decidido**: el residente paga desde la app, pero la cuenta de la pasarela es
**del conjunto, con su NIT**. La plata va directo del residente a la
copropiedad; Vecii integra y anota, no recauda. Ver
[ADR-0008](adr/0008-cobranza.md).

La interfaz está escrita en `finanzas/pasarela.ts` y no hay ningún adaptador. Lo
que falta es **elegir el primer proveedor**, y eso se decide con tres datos del
día en que se decida:

- **¿Soporta PSE?** En Colombia es la mitad de los pagos. Sin PSE no sirve.
- Comisión por transacción.
- En cuántos días desembolsa al conjunto.

Y una tabla nueva para la configuración por conjunto: qué pasarela usa y sus
credenciales — **cifradas, y que la API nunca las devuelva**. Se escriben, no se
leen.

### 5. Cargos estándar: cada conjunto con su copia (el viejo "paso 2")

Los cargos estándar —`ADMIN_CONJUNTO`, `CONSEJO`, `PORTERIA`…— existen **una sola
vez** con `conjuntoId` nulo y los comparten todos los conjuntos. Un conjunto no
los puede ajustar: si quiere que su portería además registre vehículos, tiene que
crear un cargo propio desde cero y reasignárselo a sus porteros.

No está roto —recibe un mensaje claro— pero es incómodo.

**Aplazado a propósito.** Copiar los estándar a cada conjunto es fácil (el gancho
ya existe: `modules/conjuntos/siembra.ts`, que es donde se siembran los conceptos
de cobro). Lo que falta es decidir dos cosas, y para eso hacen falta clientes
reales:

1. **Qué pasa cuando Vecii mejora un cargo.** Hoy el cambio llega a todos al
   instante; con copias, ya no.
2. **`PROPIETARIO` y `RESIDENTE` no se pueden copiar sin más.** No se otorgan, se
   derivan, y `permisos-del-rol.service.ts` los resuelve **por código** porque
   asume que son globales. Copiarlos obliga a rehacer ese camino — aunque también
   habilitaría algo deseable: que cada conjunto decida qué puede ver un
   propietario.

Ver [ADR-0007](adr/0007-supabase-o-servidor-propio.md) para el patrón de decidir
con disparador en vez de por si acaso.

### 6. `POST /conjuntos` no pide permiso

Cualquiera con una cuenta de Supabase crea conjuntos ilimitados y queda de
administrador de cada uno. Hoy no importa porque no hay registro abierto; el día
que lo haya, importa. No es un bug: es una decisión que hay que tomar antes de
abrir la puerta.

---

## 🟡 Suplantar a un usuario para ver su interfaz

Que el equipo de Vecii pueda mirar la app como la ve un residente del 501, para
soportar sin pedirle capturas. Es útil de verdad y es delicado: tiene que quedar
auditado —quién suplantó a quién y cuándo— y probablemente limitado a
`STAFF_VECII`, con la sesión marcada para que nada quede a nombre del suplantado.

---

## 🟢 Modelo de datos

**`barrio` y `localidad` en `Conjunto`**
Para el marketplace, `ciudad = "Bogotá"` son ocho millones de personas. Las
coordenadas resuelven "a 5 km" pero no el filtro que la gente usa: "en mi
localidad". Ver [ADR-0006](adr/0006-visibilidad-marketplace.md).

**`Tipologia.banos` es entero**
En Colombia se dice "2 baños y medio". Decidir si importa.

**`bloqueaConMora` no lo lee nadie**
Está en `politicas_reserva` y en el DTO, y ninguna regla lo consulta. Hoy un
administrador lo prende y no pasa nada, que es peor que no tenerlo. Ya se puede
implementar: el saldo de una unidad se calcula en `finanzas/saldo.ts`.

**`usuarios_conjuntos.activo` rompe la regla de la casa**
Todo el modelo usa `desde`/`hasta` —cerrar, no borrar— menos este, que es un
booleano. No se sabe *cuándo* dejó de pertenecer al conjunto, y eso hace falta
justo para saber a quién le tocaba la cuota de marzo.

**Zonas comunes sin mantenimiento ni festivos**
`zonas_comunes.activo` es todo o nada: cerrar la piscina del 5 al 12 significa
apagarla y acordarse de prenderla. Y los horarios son por día de semana, así que
el 20 de julio el salón abre como un lunes cualquiera.

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

## 🟡 Lo que falta encima de la campanita

La tabla `notificaciones` y sus tres endpoints ya están, y los cuatro
disparadores conectados: encomienda recibida, invitado autorizado, reserva por
aprobar, y aprobada o rechazada. Más el recordatorio, que se crea al reservar y
aparece solo una hora antes gracias a `programadaPara` — sin ninguna tarea
programada detrás.

Lo que sigue faltando son las otras dos patas, y **ninguna cambia esa tabla**:

- **El push** — que el celular suene con la app cerrada. Necesita los tokens de
  dispositivo (tabla nueva) y Expo Push. Aquí sí hace falta un trabajo que
  despierte y mande, sobre todo para los avisos programados.
- **El tiempo real** — que el número suba solo con la app abierta. Ver abajo.

Y dos cosas de mantenimiento:

- **Podar las viejas.** Una fila por persona: un reparto masivo a una torre de 60
  unidades escribe unas 120 filas. Con el tiempo hay que borrar las leídas de
  hace meses. No urge, pero no se resuelve solo.
- **Preferencias por persona.** Hoy le llega todo a todos los que corresponden.
  No todo el mundo quiere que le avisen del recibo del agua.

## 🟡 El tiempo real, y por qué no lo hace Supabase

Las 33 tablas tienen RLS habilitado **sin ninguna política**, así que la API REST
de Supabase no las expone: la puerta está cerrada con llave, no con portero. Eso
cierra un hueco que se abría solo el día del primer build —la llave publicable es
pública por diseño y viaja dentro de la app— y lo cuida `verificar-rls.mjs`, que
falla si aparece una tabla sin RLS.

**La consecuencia asumida:** Supabase Realtime deja de servir directo al cliente,
porque quien decide qué ve cada quien ahí es RLS. La alternativa habría sido
escribir unas cien políticas —33 tablas por `SELECT`/`INSERT`/`UPDATE`/`DELETE`—
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

**El módulo de notificaciones ya existe y NO resuelve esto.** Ese es la
campanita *dentro* de la app: guarda un aviso y lo muestra. El correo es otro
canal y va encima, no adentro. Lo mismo aplicará al push.

Cuando se haga, que sea un canal aparte y no SMTP metido en el registro de
usuarios: en poco tiempo van a necesitar correo la cuota generada, la reserva
confirmada y el visitante en portería.

---

## 🟡 Validaciones del servicio

**`unidadId` significa cosas opuestas en dos tablas.** En `parqueaderos` el cupo
**es** esa unidad (solo `PRIVADO`); en `asignaciones_parqueadero` esa unidad
**usa** el cupo. Mismo nombre, relación invertida. Hoy se salva con el nombre de
la relación (`ParqueaderoEsUnidad`) y un comentario, pero un comentario no es un
nombre. Candidato: renombrar el de `parqueaderos`.


---

## 🟡 API

**Custom Access Token Hook de Supabase**
Meter las membresías en el JWT para que la API deje de consultar Postgres en cada
petición. Es la tarea 1 del [ADR-0001](adr/0001-autenticacion-supabase.md).

---

## 🟡 Restricciones que Prisma no expresa

Hay **10 CHECK** puestos, y `verificar-errores.mjs` exige que cada uno tenga su
mensaje en español.

Lo que no cabe en la base es lo que **cruza filas**, y va en el servicio. Lo que
queda por hacer:

**La suma de imputaciones de un pago no puede pasar del valor del pago.** Hoy lo
cuida `reglas-imputacion.ts`, que nunca aplica de más — pero si algún día se
escriben imputaciones por otro camino, nada lo impide.

**Los módulos de un sector tienen que sumar 100%**, igual que los coeficientes
del conjunto. Falta el chequeo de salud, como `salud-coeficientes`.

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

---

## 🟢 Herramientas del repo

- Podar las ~12 skills que no aplican a Vecii (`prisma-mongodb-upgrade`,
  `prisma-compute`, `prisma-postgres*`, `expo-app-clip`, `expo-brownfield`,
  `expo-dom`, `expo-web-to-native`, `expo-module`). Bajan el costo fijo de
  contexto casi a la mitad.
- Evaluar `nestjs-expert` (comunidad; ninguna de las candidatas cubre ESM)
- **No subir a ESLint 10 todavía.** `apps/landing` lo tenía en `^10` y el lint
  reventaba con `contextOrFilename.getFilename is not a function`. No es un
  error del proyecto: `eslint-config-next` arrastra `eslint-plugin-react`, cuya
  última versión estable (7.37.5) declara `eslint ... ^9.7` como peer — ESLint
  10 quitó los métodos viejos de `context` y el plugin todavía los usa. Hay un
  `7.8.0-rc.0`, pero es un *release candidate*, y acá los rc no entran (misma
  regla que Prisma 8). Los dos frontends quedaron en ESLint 9. Revisarlo cuando
  salga el 7.8.0 final.

  El síntoma engaña: `eslint-config-next` declara el peer como `>=9.0.0`, así
  que pnpm deja instalar el 10 sin quejarse y el error aparece después, dentro
  de una regla.
- **No subir a Prisma 8 todavía.** El CLI muestra un aviso de "update available
  7.10.0 -> 8.0.0-rc.13" cada vez que se corre, pero eso es un *release
  candidate*, no una versión estable, y es un cambio de versión mayor: entre
  otras cosas renombra `migrate` a `migration`. Revisarlo cuando salga el 8.0.0
  final, y con las migraciones ya en verde el cambio es barato.
- Escribir la skill de dominio de Vecii: ESM con `.js`, Vitest, `conjuntoId`,
  `x-conjunto-id`
