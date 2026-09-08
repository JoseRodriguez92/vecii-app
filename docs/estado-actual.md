# Estado actual

Dónde quedó el proyecto y qué sigue. **Leer esto antes de tocar nada.**
Se actualiza al cerrar cada sesión; si algo aquí ya no es cierto, se corrige.

Última actualización: 7 de septiembre de 2026.

---

## 🔴 Lo primero al abrir una sesión

Desde la **raíz** del monorepo:

```powershell
pnpm db:deploy      # aplica las migraciones pendientes
pnpm db:generar     # regenera el cliente de Prisma
pnpm db:seed        # siembra módulos, permisos y roles
pnpm dev:api        # Swagger en http://localhost:3201/docs
```

**No corras `npx prisma ...` desde la raíz.** Prisma vive en `apps/api/node_modules`,
así que desde la raíz `npx` no lo encuentra, se va a npm y **se baja la última
versión publicada** — que hoy es un release candidate de Prisma 8, donde hasta los
comandos se llaman distinto (`migration` en vez de `migrate`). Para eso están los
scripts de arriba: delegan al workspace correcto y usan el Prisma 7.10 instalado.
Si necesitás un comando que no tenga script, entrá primero a `apps\api`.

**`db:push` ya no existe** — el script está, pero solo para gritar. La base la
manejan las migraciones desde el 7 de septiembre. Cada cambio de schema pasa por
`pnpm prisma:migrate` (que es `migrate dev`), y eso escribe el `.sql` y lo aplica.

El seed **no es opcional**: la API verifica al arrancar que todo permiso
declarado en un decorador exista sembrado, y se niega a levantar si falta uno.

Antes de commitear, desde la **raíz**:

```powershell
pnpm lint            # los tres apps: api, landing y la app de Expo
pnpm test            # las pruebas de dominio
cd apps\api ; npx tsc --noEmit
```

`pnpm lint` es `pnpm -r lint`, así que corre los tres workspaces. El de la app
de Expo es `expo lint` (ESLint 9 con `eslint-config-expo`) y **la primera vez
se instala solo** — si ves a pnpm bajando paquetes en medio del lint, es eso y
pasa una sola vez.

En `apps/api`, `pnpm lint` corre seis scripts propios: `verificar-schema.mjs` (campos duplicados,
relaciones sin inversa, modelos sin `@@map`, columnas sin `@map`),
`verificar-vocabulario.mjs` (que una misma cosa se llame igual en la tabla, la
carpeta, la ruta, el permiso y el tag de Swagger, y que ninguna de las
"palabras descartadas" del glosario reaparezca como nombre), `verificar-rls.mjs` (que
ninguna tabla quede expuesta por la API de Supabase), `verificar-rutas.mjs`
(que ninguna ruta quede tapada por otra declarada antes), `verificar-errores.mjs`
(que toda restricción de la base tenga un mensaje en español), y `verificar-cliente.mjs`
(que el cliente de Prisma no haya quedado viejo respecto al schema — el error que
si no aparece como un "Unknown argument" que no dice que falta un `migrate
dev`).

`pnpm test` corre Vitest. Hoy son **97 pruebas** y todas son de **dominio puro**:
la matriz de qué origen de derecho admite cada naturaleza de cupo (28), las
reglas de una reserva —política, horario, solapamiento— (16), la traducción de
los errores de la base (12), **repartir un monto entre unidades (12)**, **a qué deuda se aplica un pago (8)**,, colgar
una unidad de otra (6), **el saldo de una cuenta (9)**, la normalización de
placa (3) y el rol que se deriva de tener una unidad (3). Ese es el criterio para las que vengan: se prueba
lo que ninguna restricción de base puede cuidar, no que Prisma guarde ni que
Nest enrute.

Todas viven al lado del archivo que prueban y ninguna toca la base. Eso no es
casualidad: **las reglas se sacaron a funciones puras precisamente para poder
probarlas**, y ese es el criterio para partir un archivo — no el largo.

---

## Qué hay funcionando

**23 rutas, 99 endpoints.** Todo con Swagger documentado.

| módulo | rutas | qué resuelve |
|---|---|---|
| `auth` | `/auth` | JWT asimétrico por JWKS, y `/auth/me`: con qué arranca la app |
| `conjuntos` | `/conjuntos` | la copropiedad y su configuración |
| `estructura` | `/agrupaciones` `/tipologias` `/unidades` | torres y etapas anidadas, plantas, unidades con carga masiva y chequeo de coeficientes |
| `usuarios` | `/usuarios` | registrar personas, quién vive dónde, cerrar vínculos |
| `instalaciones` | `/zonas-comunes` `/zonas-comunes/:id/horarios` `/parqueaderos` `/parqueaderos/:id/asignaciones` | los bienes comunes y a qué horas abren; los cupos y quién tiene derecho a cada uno |
| `porteria` | `/casilleros` `/encomiendas` `/invitados` `/vehiculos` `/bicicletas` | la casilla de cada unidad, lo que llega y quién lo retira, a quién autorizó cada unidad |
| `reservas` | `/espacios-reservables` `/politicas-reserva` `/reservas` | qué se puede apartar, con qué reglas, y quién apartó |
| `notificaciones` | `/notificaciones` | la campanita: los avisos de cada persona |
| `finanzas` | `/conceptos-cobro` `/cuentas-cobro` `/pagos` | qué se le cobra a cada unidad, cómo va la cuenta y con qué plata se cubrió |
| `roles` | `/roles` `/modulos` | qué puede hacer cada cargo. **Cada conjunto crea y administra los suyos** |
| `plataforma` | `/usuarios-plataforma` | el equipo de Vecii y su acceso a todos los conjuntos |

**La campanita abre lo que anuncia.** Un aviso guarda `entidad` + `entidadId`, y
las tres entidades que menciona —`encomienda`, `invitado`, `reserva`— tienen su
`GET /:id`. Cada uno usa la MISMA regla de visibilidad que su "mías", no una
nueva: si fueran dos, un aviso podría llevar a una pantalla que después dice "no
puedes ver esto". Y responden **404 y no 403** cuando no se puede ver, porque un
403 confirma que el id existe.

**RBAC por permisos.** Módulos → permisos → roles → asignaciones. Los roles de
propietario y residente **se derivan** de `usuarios_unidades`, no se otorgan.

**Concurrencia resuelta en reservas.** `pg_advisory_xact_lock` por espacio, dentro
de la misma transacción que inserta.

---

## Con qué arranca la app

`GET /auth/me` es la primera llamada y **no lleva `x-conjunto-id`** — es la que
dice cuáles hay. Devuelve la persona y, por cada conjunto donde tiene vínculo
activo:

| campo | para qué |
|---|---|
| `id` | lo que va en la cabecera `x-conjunto-id` |
| `permisos` | **con esto se arma el menú**. Ya resueltos, ordenados |
| `roles` | solo para mostrarlos ("Consejo", "Portería"). No se decide nada con ellos |
| `unidades` | "mi apartamento" en ese conjunto, hoy, con la relación |
| `vinculoId` | el id en `usuarios_conjuntos`. Casi nunca hace falta |

**Por qué permisos y no roles.** Propietario y residente no se otorgan: se
derivan de tener una unidad. Antes `/auth/me` devolvía los roles otorgados, así
que un propietario —que es justo quien más va a usar la app— llegaba con la
lista vacía. Y un conjunto puede inventarse un "Comité de Deportes" y darle
`reservas.administrar`: preguntar por rol es apostar a una lista que cambia sin
avisar.

**Por qué es el mismo cálculo que el guard.** Los dos usan
`PermisosDelUsuarioService`. Si
fueran dos implementaciones, el día que cambie la regla la app dibujaría
botones que el guard rechaza, o escondería cosas que sí se pueden — y eso no se
descubre probando, se descubre cuando un usuario reclama. Lo que aparece en
`/auth/me` es exactamente lo que la API va a dejar pasar.

Los roles efectivos se suman de tres orígenes: `usuarios_plataforma` (todos los
conjuntos), `usuario_conjunto_roles` (solo ese) y `usuarios_unidades`
(derivados, nadie los otorga).

La pregunta está partida en dos archivos que se leen como pareja:

| archivo | responde |
|---|---|
| `permisos-del-rol.service.ts` | qué permisos da cada cargo |
| `permisos-del-usuario.service.ts` | qué permisos tiene **esta persona**, aquí, hoy |

El segundo suma el primero con lo que se deriva de tener una unidad. **Ojo con
la palabra "alcance"**: en este repo significa otra cosa — el alcance de FILA
(`exigirAlcance`, "¿esa unidad es tuya?"), que es más fino y lo resuelve el
servicio, no el guard.

---

## Cuando algo falla

Un solo lugar convierte excepciones en respuestas HTTP: `ErroresFilter`, global.
Tres caminos:

1. **`HttpException` pasa derecho.** Los servicios ya lanzan mensajes buenos y
   en español; el filtro no tiene nada que mejorarles.
2. **Un error de la base se traduce.** `traducir-prisma.ts` es una función pura
   con 12 pruebas.
3. **Todo lo demás es un 500 con `referencia`** — ocho caracteres. Al usuario le
   llega el código y nada más; el error completo queda en el log con esa misma
   referencia. Un reporte de "me salió el error 3f2a" se puede rastrear sin
   filtrarle a nadie una consulta SQL.

Un choque de unicidad responde así:

```json
{
  "statusCode": 409,
  "message": "Ya hay un conjunto registrado con ese NIT.",
  "error": "CONFLICT",
  "campos": ["nit"]
}
```

`campos` va en camelCase, igual que los DTO, para que la pantalla resalte el
campo que chocó sin traducir nada.

**Dos cosas que solo se supieron midiendo**, y que están escritas en el código
porque toda la documentación de internet dice lo contrario:

- Con `@prisma/adapter-pg` **no existe `meta.target`**. El nombre del índice
  llega en `meta.driverAdapterError.cause.constraint.index`. Por eso la
  traducción es por nombre de índice y no por columna.
- Una violación de **CHECK no tiene código propio de Prisma**: cae al saco
  genérico como `P2039`, y el nombre del CHECK solo está dentro del mensaje de
  Postgres.

Los mensajes viven en `mensajes-de-restriccion.ts`, uno por restricción, y
`verificar-errores.mjs` comprueba en cada lint que ninguna quede sin traducir
—ni sobre un mensaje de una restricción que ya se borró—. El día que se agregue
un índice único sin mensaje, lo dice el lint y no un administrador por teléfono.

---

## Cómo está organizado el código

Cada módulo tiene, como mucho, cuatro clases de archivo. El orden importa
porque es el orden en que se lee:

| archivo | qué contiene | toca la base |
|---|---|---|
| `x.controller.ts` | las rutas, los permisos y el Swagger | no |
| `x.service.ts` | orquesta: lee, valida, escribe, avisa | sí |
| `reglas-x.ts` | las decisiones, en funciones puras | **no** |
| archivo compartido del módulo | lo que dos servicios del módulo repetirían | sí |

Las **reglas puras** son el corazón: reciben lo ya leído y devuelven un veredicto.
Por eso `reglas-parqueadero.ts` y `reglas-reserva.ts` tienen pruebas sin base de
datos ni mocks. Cuando un servicio se hace largo, la pregunta no es "¿cuántas
líneas tiene?" sino **"¿cuántas cosas distintas decide?"**.

Lo que se separó por esa pregunta:

- `reservas` — apartar un espacio (`reservas.service.ts`) es un momento; asignar
  el cupo concreto cuando llega el carro (`cupos.service.ts`) es otro, y lo hace
  otra persona. `ocupacion.ts` guarda lo que ambos preguntan: "¿esto ya está
  tomado?".
- `usuarios` — registrar a la persona (`usuarios.service.ts`), darle cuenta en
  Supabase (`acceso.service.ts`) y otorgarle un cargo (`cargos.service.ts`) son
  tres decisiones distintas. `UsuariosService` ya no sabe que Supabase existe.
- `notificaciones` — qué se guarda y cómo se ve (`notificaciones.service.ts`)
  contra quién debe enterarse (`destinatarios.service.ts`).
- `porteria` — `registros.ts` tiene lo que comparten invitados, vehículos y
  bicicletas, que son la misma forma: algo de una unidad, vigente entre dos
  fechas, que portería consulta en la puerta.

Y lo que se unificó porque estaba escrito dos y tres veces:

- `common/placa.ts` — una placa se normaliza igual en portería y en reservas, o
  el carro que portería tiene enfrente no aparece en la búsqueda.
- `estructura/arbol-agrupaciones.ts` — un solo recorrido del árbol. Antes había
  tres, con tres límites de profundidad distintos.

---

## El hueco se cerró

**Las 26 tablas del núcleo tienen API.** Ya no queda nada que solo se pueda cargar a mano en
DBeaver, que fue el estado del proyecto durante casi toda su vida.

Lo último en entrar fueron los parqueaderos y sus asignaciones, con la regla que
cruza las dos cosas: qué origen de derecho es válido para qué naturaleza de cupo.
Vive en `reglas-parqueadero.ts`, en funciones puras, y tiene **las primeras
pruebas del repo** — las 20 celdas de esa matriz, sin base de datos ni mocks.

Lo que falta ya no son tablas sin API: son **sistemas enteros**.

---

## A medias, y hay que saberlo

- **El correo no se envía.** `generateLink` crea la cuenta en Supabase pero nadie
  manda el enlace: falta el SMTP propio. Entran con "olvidé mi contraseña".
  El módulo de notificaciones **no** cubre esto: es la campanita dentro de la
  app, y el correo es otro canal que va encima.
- **Las reservas abiertas no las cierra nadie.** Si portería olvida la salida, el
  cupo queda tomado y la cuenta de esa unidad crece sola.
- **Ninguna reserva se marca `CUMPLIDA`** salvo las de parqueadero al salir.
- **Sin control de ingreso**, el sistema conoce las reservas pero no la ocupación
  real: un carro que entró sin reservar es invisible.
- **No hay tarifas**, así que todavía nadie paga nada.

---

## A medio construir

**Finanzas.** El diseño está en [ADR-0008](adr/0008-cobranza.md). Modelo
completo, y ya se puede **facturar el mes**: generar el
borrador, revisarlo, emitirlo y consultarlo. Falta la otra mitad —**registrar
pagos e imputarlos**— y con ella `reglas-imputacion.ts`.

El reparto es una función pura con 12 pruebas, y una de ellas es la que
importa: **la suma da exactamente el monto**. Multiplicar y redondear cada parte
por separado deja el total unos pesos corrido, todos los meses, y el presupuesto
no cierra sin que nadie sepa por qué.

## Sin empezar

Asambleas y votación por coeficiente, PQRS y cartelera, el marketplace
(diseñado en los ADR 0005 y 0006), y las apps de Expo.

---

## Orden sugerido

1. **Cerrar el backend para la interfaz.** Son siete cosas, y están en
   [`pendientes.md`](pendientes.md) con la evidencia de cada una: los errores
   llegan como 500, `/auth/me` no dice qué puede hacer la persona, la campanita
   no puede abrir nada, ninguna lista pagina. Ninguna es un módulo nuevo: son
   huecos que solo se ven cuando alguien va a construir pantallas encima.
2. **La interfaz.** `apps/vecii` es la plantilla de Expo con login y una lista
   de conjuntos. Los 99 endpoints solo se usan desde Swagger, así que ningún
   conjunto puede usar esto todavía, por bien modelado que esté.
3. **Finanzas** — cuando el resto genere los hechos que hay que cobrar.
4. **Control de ingreso** — un botón, no hardware. Desbloquea el cobro real.
5. **Asambleas** — es para lo que existen los coeficientes, junto con cobrar.

---

## Decisiones recientes, para no volver a discutirlas

- **`entregas` → `encomiendas`.** Una encomienda es lo que se le *encomienda* a
  portería. Además la tabla se llamaba igual que uno de sus propios estados.
- **Se borró la tabla de invitaciones.** Se llamó `invitaciones`, después
  `vinculaciones`, y tres discusiones seguidas fueron sobre su nombre y ninguna
  sobre si hacía falta. Una tabla que hay que renombrar dos veces es una tabla
  que nadie sabe qué es. El fondo: decía que alguien se vuelve propietario del
  501 cuando hace clic en un correo, y es al revés — lo es porque tiene la
  escritura. Ahora `POST /usuarios` crea la cuenta y el vínculo de una vez.
- **Registrar solo agrega.** Nunca cierra un vínculo anterior: un propietario
  con parqueadero privado tiene dos unidades y las dos son correctas. La mudanza
  es una acción aparte, `PATCH /usuarios/:id/unidades/:unidadId`.
- **No se agrega `activo` a `usuarios_unidades`.** Ya existe `hasta`, que además
  dice *cuándo* — y hace falta para saber a quién le tocaba la cuota de enero.
- **El propietario no crea usuarios ni reparte cargos.** Puede vincular gente a
  *sus* unidades y nada más. Si un arrendatario necesita registrar a su familia,
  **lo hace la administración** — que es como opera un conjunto de verdad, sobre
  todo cuando el dueño arrendó por inmobiliaria y no aparece.
- **No existe el estado `REPARTIDA`.** El sistema solo guarda estados que él
  mismo provoca; no puede verificar que portería llenó los casilleros.
- **Un reparto masivo es UNA fila,** no una por unidad.
- **Los cupos de visitantes no se asignan a nadie** y no llevan filas en
  `asignaciones_parqueadero`.
- **Los vehículos van en `porteria`, no en `instalaciones`.** El carro de un
  residente no es un bien del conjunto: es suyo. Lo que el conjunto hace con él
  es dejarlo entrar, y eso es la puerta.
- **Carros y bicicletas en tablas distintas.** Se identifican distinto: una placa
  es única, pública y la puso el Estado; el serial de una bicicleta lo sabe el
  dueño si tiene suerte. Una sola tabla habría obligado a que la placa fuera
  opcional, y entonces deja de servir para lo único que sirve — que portería
  teclee tres letras y sepa de quién es.
- **La persona se separó de la cuenta.** `usuarios.id` era el `sub` de Supabase,
  así que anotar a alguien exigía crearle cuenta — y el administrador tiene que
  poder registrar al copropietario que no gestiona y al dueño que vive afuera,
  porque la Ley 675 le exige el registro de propietarios y residentes. Ahora se
  identifica por **correo o documento**, y basta uno. El documento es la
  identidad de verdad: todo el mundo tiene, no todo el mundo tiene correo.
- **`zonas_comunes.reservable` se borró.** Decía lo mismo que tener un espacio
  reservable apuntando a la zona, y las dos podían contradecirse sin que nada lo
  impidiera —cruza dos tablas, ningún CHECK lo ve—. El seed lo mostraba en vivo:
  un Salón Social con `reservable: true` y sin espacio. Ahora la pregunta "¿se
  aparta?" tiene una sola respuesta: si trae espacio.
- **El árbol de unidades accesorias tiene exactamente dos niveles.** Una unidad
  es principal o accesoria, nunca las dos: un parqueadero no tiene depósito
  propio. Se valida en las **dos direcciones** — no colgarse de una que ya
  cuelga, y no colgar una que ya tiene cosas colgando—. Faltaba la segunda, y
  sin ella quedaba `P-34 → 501 → 302`: al facturar, el 501 y su parqueadero se
  quedaban sin recibo y nadie se enteraba.
- **Vehículos y bicicletas no comparten clase base.** Repiten la forma pero no
  las reglas: la placa es obligatoria y única, el serial es opcional. Una clase
  genérica con banderas obliga a leer dos archivos para entender uno. Lo que sí
  se compartió es lo idéntico —el `include`, la validación del propietario, la
  vigencia— y vive en `porteria/registros.ts`.
- **Un método llamado `notificar` tiene que notificar.** Cambiaba la fila a
  `NOTIFICADA` y no le avisaba a nadie: el estado decía una cosa y el residente
  no veía nada. *Trackear no es avisar* — está en `AGENTS.md` como pregunta
  obligatoria cada vez que se construye algo.
- **Las restricciones van en su propia migración, no pegadas a la línea base.**
  La línea base se marca como aplicada sin ejecutarse —la base ya existía— así
  que todo lo que se le pegue encima nunca llega a Postgres.

---

## Pendientes

En [`pendientes.md`](pendientes.md), ordenados por urgencia. Los dos rojos son
**la interfaz** —que es lo que sigue— y **el ingreso por celular**; los de
facturación no aplican hasta que haya finanzas.

---

## Cómo se trabaja acá

Las convenciones están en [`../AGENTS.md`](../AGENTS.md) y el vocabulario en
[`dominio/glosario.md`](dominio/glosario.md). Lo esencial:

- **Antes de aceptar una tabla, se escriben filas reales.** Casi todos los
  errores de diseño de este proyecto aparecieron al intentar escribir un caso
  colombiano concreto, no al razonar en abstracto.
- **Un nombre, en todas partes:** tabla, carpeta, ruta, permiso y tag de Swagger
  comparten el nombre. El tag siempre termina en un nombre de tabla.
- **Lo derivable se deriva.** No se guarda una conclusión al lado del hecho.
- **Cerrar, no borrar.** Los derechos que terminan llevan `hasta`.
- Commits en español, presente ("agrega", "corrige").
