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

Antes de commitear:

```powershell
cd apps\api
pnpm lint                                      # oxlint + los dos verificadores
npx tsc --noEmit
```

`pnpm lint` corre tres scripts propios: `verificar-schema.mjs` (campos duplicados,
relaciones sin inversa, modelos sin `@@map`) y `verificar-vocabulario.mjs` (que
una misma cosa se llame igual en la tabla, la carpeta, la ruta, el permiso y el
tag de Swagger), y `verificar-cliente.mjs` (que el cliente de Prisma no haya
quedado viejo respecto al schema — el error que si no aparece como un
"Unknown argument" que no dice que falta un `migrate dev`).

---

## Qué hay funcionando

**18 rutas, 75 endpoints.** Todo con Swagger documentado.

| módulo | rutas | qué resuelve |
|---|---|---|
| `auth` | `/auth` | JWT asimétrico de Supabase verificado por JWKS |
| `conjuntos` | `/conjuntos` | la copropiedad y su configuración |
| `estructura` | `/agrupaciones` `/tipologias` `/unidades` | torres y etapas anidadas, plantas, unidades con carga masiva y chequeo de coeficientes |
| `usuarios` | `/usuarios` | registrar personas, quién vive dónde, cerrar vínculos |
| `instalaciones` | `/zonas-comunes` `/zonas-comunes/:id/horarios` | los bienes comunes y a que horas abren |
| `porteria` | `/casilleros` `/encomiendas` `/invitados` | la casilla de cada unidad, lo que llega y quién lo retira, a quién autorizó cada unidad |
| `reservas` | `/espacios-reservables` `/politicas-reserva` `/reservas` | qué se puede apartar, con qué reglas, y quién apartó |
| `roles` | `/roles` `/modulos` | qué puede hacer cada cargo. **Cada conjunto crea y administra los suyos** |
| `plataforma` | `/usuarios-plataforma` | el equipo de Vecii y su acceso a todos los conjuntos |

**RBAC por permisos.** Módulos → permisos → roles → asignaciones. Los roles de
propietario y residente **se derivan** de `usuarios_unidades`, no se otorgan.

**Concurrencia resuelta en reservas.** `pg_advisory_xact_lock` por espacio, dentro
de la misma transacción que inserta.

---

## El hueco que queda

### Los parqueaderos no tienen API

Las zonas comunes ya la tienen (módulo `instalaciones`). Faltan las otras dos
tablas de ese mismo módulo, que hoy se cargan a mano:

| tabla | consecuencia |
|---|---|
| `parqueaderos` | los cupos V-01…V-50 no existen, así que `POST /reservas/:id/cupo` no tiene qué asignar |
| `asignaciones_parqueadero` | no hay cómo decir "el P-101 es del 501" ni correr el sorteo anual |

Y falta la validación que cruza las dos: qué origen de asignación es válido para
qué naturaleza de cupo. La tabla está escrita en [`pendientes.md`](pendientes.md).

---

## A medias, y hay que saberlo

- **El correo no se envía.** `generateLink` crea la cuenta en Supabase pero nadie
  manda el enlace: falta el SMTP propio. Entran con "olvidé mi contraseña".
- **Las reservas abiertas no las cierra nadie.** Si portería olvida la salida, el
  cupo queda tomado y la cuenta de esa unidad crece sola.
- **Ninguna reserva se marca `CUMPLIDA`** salvo las de parqueadero al salir.
- **Sin control de ingreso**, el sistema conoce las reservas pero no la ocupación
  real: un carro que entró sin reservar es invisible.
- **No hay tarifas**, así que todavía nadie paga nada.

---

## Sin empezar

Finanzas (tarifas, cuotas, pagos, estado de cuenta), asambleas y votación por
coeficiente, PQRS y cartelera, el marketplace, y las apps de Expo.

---

## Orden sugerido

1. **Parqueaderos y zonas comunes** — desbloquean lo que ya está construido.
2. **Control de ingreso** — un botón, no hardware. Desbloquea el cobro real.
3. **Finanzas** — al final, cuando el resto genere los hechos que hay que cobrar.

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
- **`zonas_comunes.reservable` se borró.** Decía lo mismo que tener un espacio
  reservable apuntando a la zona, y las dos podían contradecirse sin que nada lo
  impidiera —cruza dos tablas, ningún CHECK lo ve—. El seed lo mostraba en vivo:
  un Salón Social con `reservable: true` y sin espacio. Ahora la pregunta "¿se
  aparta?" tiene una sola respuesta: si trae espacio.
- **Las restricciones van en su propia migración, no pegadas a la línea base.**
  La línea base se marca como aplicada sin ejecutarse —la base ya existía— así
  que todo lo que se le pegue encima nunca llega a Postgres.

---

## Pendientes

En [`pendientes.md`](pendientes.md), ordenados por urgencia. **No queda ninguno
en rojo** fuera de los de facturación, que no aplican hasta que haya finanzas.
El siguiente en la fila son los `parqueaderos` y sus asignaciones: existen como
tablas pero no tienen API, y sin ellas `POST /reservas/:id/cupo` no tiene qué
asignar.

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
