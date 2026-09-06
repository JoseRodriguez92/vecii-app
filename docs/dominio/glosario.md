# Glosario

Una palabra por concepto. La misma en el schema, en el código, en la interfaz y
en las conversaciones del equipo.

Esto no es purismo: cuando el mismo concepto tiene tres nombres, cada persona
que entra al proyecto tiene que reaprenderlo, y tarde o temprano alguien modela
dos veces la misma cosa creyendo que son distintas.

## Las cosas

| Concepto | Palabra | Qué NO es |
|---|---|---|
| La copropiedad completa, con su NIT | **conjunto** | no "edificio", no "propiedad", no "condominio" |
| Cómo se subdivide el conjunto | **agrupación** | no "torre" — torre es solo un *tipo* de agrupación |
| Propiedad privada con coeficiente | **unidad** | no "apartamento" — apartamento es un *tipo* de unidad |
| Planta repetida (65 m², 2 hab) | **tipología** | no "modelo", no "molde" |
| Bien común: piscina, salón, gym | **zona común** | nunca "unidad" — no tiene dueño ni coeficiente |
| Cupo de parqueadero, como cosa física | **parqueadero** | no "puesto", no "celda" |
| Lo que se puede apartar, con capacidad | **espacio reservable** | no "recurso" |

## Las relaciones entre personas y cosas

| Concepto | Palabra | Tabla |
|---|---|---|
| Persona ligada a un conjunto | **vínculo** | `usuarios_conjuntos` |
| Persona ligada a una unidad | **ocupación** | `usuarios_unidades` |
| Cargo que alguien otorga | **rol** | `roles` + `usuario_conjunto_roles` |
| Derecho de largo plazo sobre un cupo | **asignación** | `asignaciones_parqueadero` |
| Uso puntual de un espacio | **reserva** | `reservas` |

**Asignación vs. reserva** es la distinción que más se confunde: la asignación
dura meses o años ("el P-101 es del 501"); la reserva dura horas ("el sábado de
2 a 6").

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
| permisos | `usuarios.leer`, `usuarios.invitar` |
| tag de Swagger | `usuarios` |

**El tag de Swagger siempre termina en un nombre de tabla**, y cuando hay
submódulos usa `modulo · tabla`:

- `estructura · unidades` ✓
- `usuarios · invitaciones` ✓
- `personas` ✗ — no existe ninguna tabla `personas`

Esto se descubrió al revés: el módulo se llamó `personas` porque sonaba humano,
y en Swagger apareció un grupo que no correspondía a nada de la base de datos.
Se renombró completo a `usuarios`. El costo de un sinónimo bonito es que a los
tres meses nadie sabe si `personas` y `usuarios` son lo mismo.

**Lo derivable se deriva, no se guarda.** La categoría de una unidad sale de su
tipo; los roles de propietario y residente salen de las ocupaciones. Guardar la
conclusión junto al hecho es garantizar que algún día se contradigan.

## Colisiones a propósito

`PORTERIA` existe como rol (la persona) y como tipo de zona común (la caseta).
Son cosas distintas y el contexto las separa; renombrar una sería menos preciso
que convivir con el parecido.
