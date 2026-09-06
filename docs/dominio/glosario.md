# Glosario

Una palabra por concepto. La misma en el schema, en el código, en la interfaz y
en las conversaciones del equipo.

Esto no es purismo: cuando el mismo concepto tiene tres nombres, cada persona
que entra al proyecto tiene que reaprenderlo, y tarde o temprano alguien modela
dos veces la misma cosa creyendo que son distintas.

## Las cosas

| Concepto | Palabra | Tabla | Qué NO es |
|---|---|---|---|
| La copropiedad completa, con su NIT | **conjunto** | `conjuntos` | no "edificio", no "propiedad", no "condominio" |
| Cómo se subdivide el conjunto | **agrupación** | `agrupaciones` | no "torre" — torre es solo un *tipo* de agrupación |
| Propiedad privada con coeficiente | **unidad** | `unidades` | no "apartamento" — apartamento es un *tipo* de unidad |
| Planta repetida (65 m², 2 hab) | **tipología** | `tipologias` | no "modelo", no "molde" |
| Bien común: piscina, salón, gym | **zona común** | `zonas_comunes` | nunca "unidad" — no tiene dueño ni coeficiente |
| Franja en que abre una zona común | **horario** | `horarios_zona_comun` | no "agenda" — se guarda en minutos desde medianoche |
| Cupo de parqueadero, como cosa física | **parqueadero** | `parqueaderos` | no "puesto", no "celda" |
| Lo que se puede apartar, con capacidad | **espacio reservable** | `espacios_reservables` | no "recurso" |
| Las reglas de un espacio | **política** | `politicas_reserva` | no lleva tarifas: eso es finanzas |
| La casilla física de una unidad | **casillero** | `casilleros` | no "buzón" — no tiene llave |
| Lo que le encomiendan a portería | **encomienda** | `encomiendas` | no "entrega" — eso es uno de sus estados |
| Persona con cuenta en Vecii | **usuario** | `usuarios` | no "persona", no "residente" a secas |

Toda tabla tiene que aparecer en alguna de estas listas. Lo verifica
`apps/api/scripts/verificar-vocabulario.mjs`.

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

**Los roles efectivos de una persona salen de TRES lugares**, y el guard los suma:

| origen | ejemplo | cómo llega |
|---|---|---|
| `usuarios_plataforma` | `SUPER_ADMIN` | lo otorga Vecii. Vale en **todos** los conjuntos |
| `usuario_conjunto_roles` | `CONSEJO`, `ADMIN_CONJUNTO`, `PORTERIA` | se lo otorgaron **en ese** conjunto |
| `usuarios_unidades` | `PROPIETARIO`, `RESIDENTE` | **derivado**, nadie lo otorga |

Mirar solo la tabla de roles y concluir "estos son sus roles" es un error: los
derivados no tienen fila ahí. El día que alguien vende el 501 deja de ser
propietario **solo**, sin que nadie tenga que acordarse de borrarle nada — que es
justamente el punto de derivarlos.

Los tres comparten el catálogo `roles`, y ahí `conjuntoId` separa los dos
primeros: **null = de plataforma**. La misma persona tiene los tres sin conflicto:
quien trabaja en Vecii también vive en algún lado.

Meter `SUPER_ADMIN` en `usuario_conjunto_roles` era el error: un rol global en una
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
| Una acción concreta que se puede permitir | **permiso** | `permisos` |
| Qué permisos tiene cada rol | *(tabla puente)* | `roles_permisos` |

El código de un permiso es `modulo.espacio.accion` y **siempre empieza por un
módulo que existe**: `usuarios.crear`, `porteria.encomiendas.registrar`. Eso lo
verifica el script, igual que verifica que el tag de Swagger termine en un nombre
de tabla.

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

## Colisiones a propósito

`PORTERIA` existe como rol (la persona) y como tipo de zona común (la caseta).
Son cosas distintas y el contexto las separa; renombrar una sería menos preciso
que convivir con el parecido.
