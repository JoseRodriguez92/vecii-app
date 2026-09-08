# Glosario

Una palabra por concepto. La misma en el schema, en el código, en la interfaz y
en las conversaciones del equipo.

Esto no es purismo: cuando el mismo concepto tiene tres nombres, cada persona
que entra al proyecto tiene que reaprenderlo, y tarde o temprano alguien modela
dos veces la misma cosa creyendo que son distintas.

## Las cosas

| Concepto | Palabra | Tabla | Qué NO es |
|---|---|---|---|
| La copropiedad completa, con su NIT. **Es el tenant** | **conjunto** | `conjuntos` | no "edificio", no "propiedad", no "condominio" |
| Cómo se subdivide el conjunto | **agrupación** | `agrupaciones` | no "torre" — torre es solo un *tipo* de agrupación |
| Propiedad privada con coeficiente | **unidad** | `unidades` | no "apartamento" — apartamento es un *tipo* de unidad |
| Planta repetida (65 m², 2 hab) | **tipología** | `tipologias` | no "modelo", no "molde" |
| Grupo de unidades que comparte un gasto que las demás no pagan | **sector** | `sectores` | no "agrupación" — la agrupación es física, el sector es de reparto y puede cruzarlas |
| Cuánto le toca a una unidad dentro de un sector | **módulo de contribución** | `unidades_sectores` | no "coeficiente" — son **dos repartos distintos** que conviven |
| Lo que se le puede cobrar a una unidad. El catálogo | **concepto** | `conceptos_cobro` | no "cobro" — el concepto es el tipo, el cobro es la ocurrencia |
| La cuenta del mes de una unidad. **Es lo que se paga** | **cuenta de cobro** | `cuentas_cobro` | no "factura" — no es un documento fiscal |
| Una línea de esa cuenta | **cobro** | `cobros` | no "cuota" — la cuota es *un* concepto entre varios |
| Plata que entró | **pago** | `pagos` | no "abono" — abono significa además *parcial*, y confunde |
| Qué cuenta cubrió un pago, y por cuánto | **imputación** | `imputaciones` | no "aplicación", no "saliente" — no sale plata, es una anotación |
| Bien común: piscina, salón, gym | **zona común** | `zonas_comunes` | nunca "unidad" — no tiene dueño ni coeficiente |
| Franja en que abre una zona común | **horario** | `horarios_zona_comun` | no "agenda" — se guarda en minutos desde medianoche |
| Cupo de parqueadero, como cosa física | **parqueadero** | `parqueaderos` | no "puesto", no "celda" |
| Lo que se puede apartar, con capacidad | **espacio reservable** | `espacios_reservables` | no "recurso" |
| Las reglas de un espacio | **política** | `politicas_reserva` | no lleva tarifas: eso es finanzas |
| La casilla física de una unidad | **casillero** | `casilleros` | no "buzón" — no tiene llave |
| Lo que le encomiendan a portería | **encomienda** | `encomiendas` | no "entrega" — eso es uno de sus estados |
| Un aviso a una persona | **notificación** | `notificaciones` | no "alerta", no "mensaje" — un mensaje se responde, un aviso no |
| Carro o moto de una unidad | **vehículo** | `vehiculos` | no "carro" — la moto también; y no es la placa de un invitado |
| Bicicleta registrada por una unidad | **bicicleta** | `bicicletas` | va aparte: se identifica por serial, no por placa |
| Persona, tenga cuenta o no | **usuario** | `usuarios` | no "persona" a secas, no "residente" — residente es un *rol* |

Toda tabla tiene que aparecer en alguna de estas listas. Lo verifica
`apps/api/scripts/verificar-vocabulario.mjs`.

**El conjunto es el tenant.** Casi toda tabla lleva `conjuntoId`, toda consulta
arranca por él, y el guard lo saca de la cabecera `x-conjunto-id`. Las FK
compuestas `[xId, conjuntoId] → [id, conjuntoId]` existen para que **Postgres
rechace** una fila de un conjunto apuntando a algo de otro: la incoherencia no es
que esté prohibida, es que no se puede escribir.

`roles` es la única tabla donde `conjuntoId` es opcional, y por eso lleva
`ambito` — ver más abajo.

## Las relaciones entre personas y cosas

| Concepto | Palabra | Tabla |
|---|---|---|
| Persona ligada a un conjunto | **vínculo** | `usuarios_conjuntos` |
| Persona ligada a una unidad | **ocupación** | `usuarios_unidades` |
| Cargo que alguien otorga | **rol** | `roles` + `usuario_conjunto_roles` |
| Derecho de largo plazo sobre un cupo | **asignación** | `asignaciones_parqueadero` |
| Uso puntual de un espacio | **reserva** | `reservas` |
| Persona autorizada a entrar por una unidad | **invitado** | `invitados` |
| Cargo de Vecii, no de un conjunto | **rol de plataforma** | `usuarios_plataforma` |
| Quien administra el conjunto (Ley 675) | **administrador** | rol `ADMIN_CONJUNTO` |

**Asignación vs. reserva** es la distinción que más se confunde: la asignación
dura meses o años ("el P-101 es del 501"); la reserva dura horas ("el sábado de
2 a 6").

**Una reserva se cierra de dos formas, y depende de qué se apartó:**

| | qué se hace | `fin` |
|---|---|---|
| zona común | se **aparta una franja** — el salón de 2 a 6 | obligatorio al crear |
| pool de parqueaderos | se **ocupa un lugar** — hasta que la visita se vaya | null hasta la salida |

Es **derivado**, no configurable: nadie sabe a qué hora se va su mamá, y obligar
un `fin` ahí sería obligar a inventar un dato. Mientras `fin` es null el cupo
sigue ocupado y la cuenta corre; `POST /reservas/:id/salida` lo cierra.

Con el fin abierto, **la reserva es la visita**: por eso no existe una tabla
`visitas` aparte.

**"Administrador" es una sola cosa: la figura de la Ley 675**, quien administra
el conjunto. Nunca el equipo de Vecii — ese es `STAFF_VECII`, y antes se llamaba
`SUPER_ADMIN`, que llevaba "admin" adentro y por eso se confundían en cada
conversación.

**`roles.codigo` es texto, no un enum.** Un enum le ponía techo a la tabla: solo
cabían los ocho valores declarados, y un "Comité de Deportes" inventado por un
conjunto no tenía dónde ir. Los pocos códigos que el sistema conoce por nombre
—`STAFF_VECII`, `ADMIN_CONJUNTO`, `PROPIETARIO`, `RESIDENTE`— viven en
`src/common/roles.ts`. Los demás son datos opacos: el código nunca los menciona,
porque pregunta por **permisos**, no por roles. Por eso un rol inventado funciona
sin tocar una línea.

**Los roles efectivos de una persona salen de TRES lugares**, y el guard los suma:

| origen | ejemplo | cómo llega |
|---|---|---|
| `usuarios_plataforma` | `STAFF_VECII` | lo otorga Vecii. Vale en **todos** los conjuntos |
| `usuario_conjunto_roles` | `CONSEJO`, `ADMIN_CONJUNTO`, `PORTERIA` | se lo otorgaron **en ese** conjunto |
| `usuarios_unidades` | `PROPIETARIO`, `RESIDENTE` | **derivado**, nadie lo otorga |

Mirar solo la tabla de roles y concluir "estos son sus roles" es un error: los
derivados no tienen fila ahí. El día que alguien vende el 501 deja de ser
propietario **solo**, sin que nadie tenga que acordarse de borrarle nada — que es
justamente el punto de derivarlos.

Los tres comparten el catálogo `roles`, y ahí `conjuntoId` separa los dos
primeros: **null = de plataforma**. La misma persona tiene los tres sin conflicto:
quien trabaja en Vecii también vive en algún lado.

**Un conjunto puede crear sus propios cargos** —"Comité de Deportes"— y ponerles
los permisos que ya existen. Lo que **no** puede es inventar permisos: esos son el
espejo de lo que el código sabe hacer, y uno inventado no haría nada porque
ningún endpoint lo verifica.

Y edita **sus** cargos, no los estándar. `CONSEJO` sale de la Ley 675 y lo
comparten los 400 conjuntos; si uno necesita algo distinto, crea el suyo. Por eso
`roles_permisos` no necesitó saber de conjuntos: **el aislamiento lo trae el rol**,
que ya nace con su `conjuntoId`.

Meter `STAFF_VECII` en `usuario_conjunto_roles` era el error: un rol global en una
tabla que es por conjunto, y por eso solo servía donde se otorgó.

**Invitado vs. visitante** son dos conjuntos distintos, y no sinónimos:

| | quién es | ejemplo |
|---|---|---|
| **invitado** | alguien a quien **una unidad** autorizó | tu mamá, tu amigo, la empleada del 501 |
| **visitante** | cualquiera que entra sin vivir aquí | el fumigador que contrató la administración |

Todo invitado es visitante, no al revés. Por eso el cupo de parqueadero es
`VISITANTES` —que además es como se dice en cualquier conjunto— y la persona que
autoriza un residente es un **invitado**.

`invitados` tiene la misma forma que `usuarios_unidades`, a propósito: quien
**vive** ahí y quien **puede entrar** se modelan igual, con `desde`/`hasta`. Sin
`hasta` es permanente —la empleada—; con fecha es puntual. Un solo patrón cubre
los dos casos sin ningún mecanismo especial.

## El vocabulario de los permisos

| Concepto | Palabra | Tabla |
|---|---|---|
| Área funcional, para agrupar en la interfaz | **módulo** | `modulos` |
| | *lleva `ambito`: un módulo de plataforma no se le muestra al conjunto* | |
| Una acción concreta que se puede permitir | **permiso** | `permisos` |
| Qué permisos tiene cada rol | *(tabla puente)* | `roles_permisos` |

**El ámbito vive en el módulo, no en el permiso.** Para eso existen los módulos:
agrupar. `plataforma.staff.gestionar` es de un módulo `PLATAFORMA`, así que no
aparece en la pantalla de permisos de un conjunto **y** el servicio lo rechaza si
alguien lo manda a mano. Esconderlo en la interfaz no sería protegerlo.

El código de un permiso es `modulo.espacio.accion` y **siempre empieza por un
módulo que existe**: `usuarios.crear`, `porteria.encomiendas.registrar`. Eso lo
verifica el script, igual que verifica que el tag de Swagger termine en un nombre
de tabla.

## Estructura, instalaciones y reservas

Tres módulos que la gente confunde porque los tres hablan de "lo que hay en el
conjunto". La diferencia es jurídica, no de tamaño:

| Módulo | Qué agrupa | La prueba |
|---|---|---|
| `estructura` | la propiedad **privada** | tiene coeficiente y se vende |
| `instalaciones` | lo físico que se **usa** | el salón, la piscina, los cupos |
| `reservas` | cómo se **reparte** lo que existe | no es una cosa, es un turno |

Por eso una piscina no va en `unidades` aunque sea una cosa del conjunto: meterla
ahí termina, tarde o temprano, en un recibo a nombre de la piscina.

`instalaciones` cubre `zonas_comunes` con sus `horarios_zona_comun`, y
`parqueaderos` con sus `asignaciones_parqueadero`.

**No se llama `bienes_comunes`, y es a propósito.** Ese es el término de la Ley
675 y sería el más preciso si el contenido lo aguantara, pero no lo aguanta: un
parqueadero `PRIVADO` no es un bien común —tiene matrícula y coeficiente, y
existe además como `unidad`— y vive en la misma tabla que los de visitantes.
`instalaciones` no afirma nada sobre quién es dueño, así que cubre a los dos sin
mentir. Tampoco se llama `inventario`: en propiedad horizontal esa palabra ya
nombra otra cosa —el inventario de bienes que el administrador entrega al
salir— y la vamos a necesitar libre.

## Persona y cuenta no son lo mismo

| Palabra | Qué es | Dónde vive |
|---|---|---|
| **persona** | alguien del mundo real: un propietario, un residente, una empresa | una fila en `usuarios` |
| **cuenta** | con qué entra a la app | `usuarios.cuenta_id`, que apunta a Supabase |

Fueron la misma cosa hasta el 7 de septiembre: `usuarios.id` **era** el `sub` del
JWT, la tabla era un espejo de `auth.users`, y por lo tanto **una persona no
podía existir sin cuenta**.

Eso no aguanta un conjunto real. La administración carga el padrón desde las
escrituras, y de esos propietarios entran a la app una parte: los demás son el
copropietario que no gestiona, el dueño que vive afuera, y la empresa que compró
el local. A todos hay que anotarlos igual, porque la Ley 675 (art. 51, num. 2) le
exige al administrador llevar el **registro de propietarios y residentes**, y de
ahí salen el paz y salvo, la citación a la asamblea y saber quién responde por
una unidad.

La única salida era inventarles un correo. Y este proyecto no guarda mentiras:
es la misma razón por la que `coeficiente` es `null` en vez de `0`.

**La identidad es el documento, no el correo.** Todo el mundo tiene cédula,
cédula de extranjería, pasaporte, PPT o NIT; no todo el mundo tiene correo. Por
eso `@@unique([tipoDocumento, numeroDocumento])` y por eso `POST /usuarios` pide
**correo o documento**, y basta uno.

Tres consecuencias que conviene tener presentes:

- `user.id` en el código es el id de la **persona**. La traducción desde el `sub`
  del token la hace `SupabaseAuthGuard`, una sola vez por petición.
- Enlazar una cuenta a una persona **nunca se hace por correo**. Sería cómodo y
  sería un hueco: bastaría registrarse con el correo de otro para quedarse con su
  identidad. Es un acto de la administración: `POST /usuarios/:id/acceso`.
- Registrar a alguien y **darle acceso** son dos cosas distintas. Una unidad
  puede tener dos propietarios registrados y un solo gestor con cuenta — que
  además es como funciona la asamblea: [cada unidad la representa una sola
  persona](https://www.ambitojuridico.com/noticias/general/para-el-ejercicio-del-derecho-al-voto-en-la-asamblea-general-de-propietarios-cada)
  y el coeficiente no se divide.

## Los dos repartos

Dos palabras que se confunden, y una de ellas la veníamos diciendo mal.

| Palabra | Reparte | Sobre |
|---|---|---|
| **coeficiente de copropiedad** | las expensas **comunes** | el conjunto entero |
| **módulo de contribución** | las expensas de **un sector** | solo las unidades de ese sector |

**No se dice "coeficiente sectorial"**, aunque se oiga por todos lados. La Ley
675 lo llama *módulo de contribución*: lo define en el artículo 3 y le dedica el
artículo 31 completo, titulado "Sectores y módulos de contribución". Es el
término que hay que usar frente a un administrador.

El caso que lo explica solo: un conjunto de casas más una torre con ascensores.
Si todo se repartiera por coeficiente, las casas estarían pagando un ascensor que
no pueden usar.

`coeficiente` sí existe hoy, en `unidades`. Los módulos no —van con finanzas, y
son dos tablas, no una columna—. Ver
[`expensas-y-coeficientes.md`](expensas-y-coeficientes.md).
### Cómo se guardan

El **coeficiente** vive en `unidades.coeficiente`: uno por unidad, y suman 1 en
todo el conjunto.

El **módulo de contribución** vive en `unidades_sectores.modulo`: uno por unidad
**por sector**, y suman 1 dentro de cada sector.

Una unidad puede estar en varios sectores a la vez —"Torres con ascensor" y
"Zona húmeda"— con un módulo distinto en cada uno. Por eso es una tabla aparte y
no una columna más de `unidades`.

Un `sector` no es una `agrupacion`. La agrupación es física (Torre 1, Etapa 2);
el sector es de reparto y **puede cruzar agrupaciones**: "las torres 1 y 2
comparten el ascensor" es un sector con unidades de dos torres. Casi siempre
coinciden, pero cuando no coinciden es justo cuando importa.


## La familia de la propiedad

Tres palabras con la misma raíz, en tres ejes distintos. **No son sinónimos:**

| Palabra | Eje | Ejemplo |
|---|---|---|
| `PRIVADO` | **qué es la cosa** — naturaleza jurídica del bien | `NaturalezaParqueadero.PRIVADO` |
| `PROPIETARIO` | **qué es la persona** respecto de una unidad | `RelacionUnidad.PROPIETARIO` |
| `PROPIEDAD` | **de dónde sale un derecho** | `OrigenAsignacion.PROPIEDAD` |

Antes el tercero se llamaba `ESCRITURA`, que rompía la familia sin ganar nada.

Lo contrario de `PRIVADO` es **bien común**, y sus formas son `USO_EXCLUSIVO`,
`ROTATIVO` y `VISITANTES`.

## Los estados y los tipos

Un enum **es** vocabulario: una lista cerrada de palabras que usa todo el
sistema. Por eso van aquí. (`DiaSemana` es la única excepción declarada, en
`verificar-vocabulario.mjs`.)

| enum | qué decide | la trampa |
|---|---|---|
| `TipoUnidad` | apartamento, casa, local, parqueadero, depósito… | el código **no ramifica sobre esto**: usa la categoría derivada, así agregar un tipo no obliga a revisar cada `if` |
| `TipoAgrupacion` | torre, manzana, etapa, bloque, interior | "torre" es un *valor*, nunca el nombre de la tabla |
| `TipoZonaComun` | salón, BBQ, piscina, gimnasio… | **no incluye parqueadero de visitantes**: eso vive en `parqueaderos` con naturaleza `VISITANTES`. Tenerlo en dos lados obligaría a preguntarse cuál es el bueno |
| `NaturalezaParqueadero` | `PRIVADO` · `USO_EXCLUSIVO` · `ROTATIVO` · `VISITANTES` | es **naturaleza jurídica**, no cosmética: decide si tiene coeficiente y si se puede vender |
| `OrigenAsignacion` | de dónde sale el derecho a un cupo | ver la familia de la propiedad, más arriba |
| `RelacionUnidad` | `PROPIETARIO` · `ARRENDATARIO` · `RESIDENTE_AUTORIZADO` | de aquí se **derivan** los roles propietario y residente |
| `AmbitoRol` | `PLATAFORMA` · `CONJUNTO` | **dónde** se otorga un rol. No confundir con `asignable`, que dice **si** alguien lo otorga. El default es `CONJUNTO`, el menos peligroso |
| `TipoEncomienda` | `PAQUETE` · `CORRESPONDENCIA` · `CERTIFICADO` · `OTRO` | **no hay domicilios**: las porterías no reciben comida, y sin custodia no hay encomienda |
| `TipoNotificacion` | `ENCOMIENDA_RECIBIDA` · `INVITADO_AUTORIZADO` · `RESERVA_POR_APROBAR` · `RESERVA_APROBADA` · `RESERVA_RECHAZADA` · `RESERVA_PROXIMA` | la lista la inventa el código, no los conjuntos: nadie necesita un aviso que Vecii no sepa producir |
| `TipoVehiculo` | `CARRO` · `MOTO` | solo lo que tiene placa. La bicicleta va en su propia tabla, y la patineta eléctrica todavía no cae en ninguna |
| `EstadoEncomienda` | `RECIBIDA` → `NOTIFICADA` → `ENTREGADA` / `DEVUELTA` | solo estados que **el sistema provoca**. No existe `REPARTIDA` porque nadie verifica que llenaron los casilleros |
| `EstadoReserva` | `SOLICITADA` · `CONFIRMADA` · `CANCELADA` · `CUMPLIDA` · `NO_ASISTIO` | `NO_ASISTIO` existe porque muchos reglamentos sancionan la inasistencia, y sin el dato no hay cómo aplicarlo |
| `EstadoVinculo`… | — | *(no existe: la vigencia se dice con `desde`/`hasta`, no con un estado)* |
| `EstadoConjunto` | `ACTIVO` · `SUSPENDIDO` | suspendido = dejó de pagar Vecii, no que el conjunto se acabó |
| `TipoDocumento` | `CC` · `CE` · `PASAPORTE` · `PPT` · `NIT` | `NIT` porque una unidad puede ser de una empresa; `PPT` es el permiso por protección temporal |
| `CodigoConcepto` | los 3 conceptos que el sistema genera solo | los que inventa el conjunto van con `codigo` en null |
| `NaturalezaConcepto` | si el concepto suma o resta | un descuento es `ABONO`, no un valor negativo |
| `MedioPago` | por dónde entró la plata | `PASARELA` es el único sin persona que lo digite |

## Reglas de nombres

**Booleanos de estado: `activo`**, siempre en masculino aunque la tabla sea
femenina. `zonaComun.activo`, no `activa`. El género gramatical no compensa el
costo de recordar cuál lleva cuál.

**Tres pares de tiempo, y cada uno significa algo distinto:**

| Par | Significa | Dónde |
|---|---|---|
| `desde` / `hasta` | **vigencia** de un derecho. `hasta` null = vigente | roles, ocupaciones, asignaciones |
| `inicio` / `fin` | una **franja concreta** con fecha y hora | reservas |
| `apertura` / `cierre` | un **horario** recurrente, en minutos desde medianoche | horarios de zona común |

**Cerrar, no borrar.** Cuando un derecho termina se le pone `hasta`; la fila se
queda. El historial es el que responde "¿quién tenía ese cupo el año pasado?" y
"¿quién era consejero cuando se aprobó eso?".

**Las horas se guardan en minutos desde medianoche**, no como `time`. Ver el
comentario de `HorarioZonaComun` en el schema.

**Un nombre, en todas partes.** Una misma cosa se llama igual en la tabla, en
el módulo, en la ruta, en el permiso y en el tag de Swagger. Si en la base de
datos la tabla es `usuarios`, entonces:

| Dónde | Cómo |
|---|---|
| tabla | `usuarios` |
| carpeta | `src/modules/usuarios/` |
| ruta | `/api/usuarios` |
| permisos | `usuarios.leer`, `usuarios.vincular` |
| tag de Swagger | `usuarios` |

**El tag de Swagger siempre termina en un nombre de tabla**, y cuando hay
submódulos usa `modulo · tabla`:

- `estructura · unidades` ✓
- `porteria · encomiendas` ✓
- `personas` ✗ — no existe ninguna tabla `personas`

Esto se descubrió al revés: el módulo se llamó `personas` porque sonaba humano,
y en Swagger apareció un grupo que no correspondía a nada de la base de datos.
Se renombró completo a `usuarios`. El costo de un sinónimo bonito es que a los
tres meses nadie sabe si `personas` y `usuarios` son lo mismo.

**Un módulo se llama como la cosa que existe, no como la función que presta.**
`porteria`, no `seguridad`: la portería *presta* seguridad, igual que la
administración presta gestión. Nombrar la función es oblicuo —obliga a traducir
dos veces y no corresponde a nada que se pueda señalar con el dedo—. Nadie en un
conjunto dice "avisale a seguridad".

Es el mismo error de `personas`, por el otro lado: aquel era un sinónimo bonito de
algo que ya existía; este es una abstracción por encima de un lugar concreto.

No confundir con agrupar: `estructura` vale aunque no sea una tabla, porque reúne
cosas que sí se pueden señalar y su tag siempre termina en una
(`estructura · unidades`). Lo que no vale es nombrar el servicio prestado en vez
de la cosa.

**Lo derivable se deriva, no se guarda.** La categoría de una unidad sale de su
tipo; los roles de propietario y residente salen de las ocupaciones. Guardar la
conclusión junto al hecho es garantizar que algún día se contradigan.

## Cómo se cobra

Cinco tablas, y **ninguna guarda un total, un saldo ni un estado.**

```
conceptos_cobro  →  cobros  →  cuentas_cobro  ←  imputaciones  ←  pagos
   (el catálogo)    (líneas)   (lo que se paga)   (qué cubrió qué)  (lo que entró)
```

**El concepto no es el cobro.** Es la misma diferencia que hay entre `tipologias`
y `unidades`: el catálogo tiene cinco filas para siempre, los cobros crecen todos
los meses. Y por eso el cobro guarda **el valor que se cobró**, no una referencia
al precio de hoy: si mañana sube el salón, la cuenta de septiembre sigue diciendo
lo que se cobró.

**La cuenta nace al empezar el mes y va recibiendo cobros** —el salón el día 12,
la multa el 20—; al cierre el proceso mensual le agrega la administración
calculada y el administrador la emite. No se "agrupa al final".

**Se paga la cuenta, no la línea.** Nadie elige pagar solo el parqueadero: si se
dejara elegir, todos pagarían lo nuevo y la deuda vieja envejecería sola. Por eso
la imputación es a nivel de cuenta, y la regla es **la más vieja primero**.

**Una imputación no es plata que sale.** Es la anotación de a qué deuda se aplicó
la que entró. Hace falta porque un pago casi nunca corresponde a una sola cuenta:
quien se pone al día cubre julio, agosto y parte de septiembre con un solo pago.

### Lo que NO se guarda, y por qué

| pregunta | cómo se responde |
|---|---|
| ¿cuánto vale la cuenta? | se suman sus cobros |
| ¿cuánto debe? | cobros − imputaciones |
| ¿está en borrador? | `emitida_en` es null |
| ¿está vencida? | `vence_el` < hoy **y** saldo > 0 |
| ¿está pagada? | saldo = 0 |

Un `pagado: boolean` se contradice solo en cuanto llega un abono parcial, un pago
cubre tres meses, o rebota un cheque. Es la misma razón por la que se borró
`zonas_comunes.reservable`.

## Palabras descartadas

Nombres que consideramos y **no** usamos. Están aquí por dos razones: para que
nadie los vuelva a proponer sin saber que ya se discutieron, y porque
`verificar-vocabulario.mjs` los lee de esta tabla — si alguna reaparece como
nombre de tabla, columna, enum, carpeta, permiso o tag, el lint falla.

| descartada | se usa | por qué |
|---|---|---|
| `visitas` | `reservas` | con el fin abierto, la reserva **es** la visita. Una tabla aparte guardaría lo mismo dos veces |
| `inventario` | `instalaciones` | en propiedad horizontal `inventario` ya nombra otra cosa: los bienes que el administrador entrega al salir. La vamos a necesitar libre |
| `seguridad` | `porteria` | un módulo se llama como la cosa que existe, no como la función que presta. Nadie en un conjunto dice "avisale a seguridad" |
| `personas` | `usuarios` | sinónimo bonito de algo que ya existía. A los tres meses nadie sabe si son lo mismo |
| `activa` | `activo` | los booleanos de estado van en masculino aunque la tabla sea femenina. El género gramatical no compensa el costo de recordar cuál lleva cuál |

## Colisiones a propósito

`PORTERIA` existe como rol (la persona) y como tipo de zona común (la caseta).
Son cosas distintas y el contexto las separa; renombrar una sería menos preciso
que convivir con el parecido.
