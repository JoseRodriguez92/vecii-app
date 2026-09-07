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
pnpm lint            # oxlint + los tres verificadores
npx tsc --noEmit     # tipos
pnpm test            # las pruebas de dominio
```

`pnpm lint` corre cuatro scripts propios: `verificar-schema.mjs` (campos duplicados,
relaciones sin inversa, modelos sin `@@map`, columnas sin `@map`),
`verificar-vocabulario.mjs` (que una misma cosa se llame igual en la tabla, la
carpeta, la ruta, el permiso y el tag de Swagger), `verificar-rls.mjs` (que
ninguna tabla quede expuesta por la API de Supabase), y `verificar-cliente.mjs`
(que el cliente de Prisma no haya quedado viejo respecto al schema — el error que
si no aparece como un "Unknown argument" que no dice que falta un `migrate
dev`).

`pnpm test` corre Vitest. Hoy son 28 pruebas y todas son de **dominio puro**: la
matriz de qué origen de derecho admite cada naturaleza de cupo. Ese es el
criterio para las que vengan — se prueba lo que ninguna restricción de base
puede cuidar, no que Prisma guarde ni que Nest enrute.

---

## Qué hay funcionando

**22 rutas, 93 endpoints.** Todo con Swagger documentado.

| módulo | rutas | qué resuelve |
|---|---|---|
| `auth` | `/auth` | JWT asimétrico de Supabase verificado por JWKS |
| `conjuntos` | `/conjuntos` | la copropiedad y su configuración |
| `estructura` | `/agrupaciones` `/tipologias` `/unidades` | torres y etapas anidadas, plantas, unidades con carga masiva y chequeo de coeficientes |
| `usuarios` | `/usuarios` | registrar personas, quién vive dónde, cerrar vínculos |
| `instalaciones` | `/zonas-comunes` `/zonas-comunes/:id/horarios` `/parqueaderos` `/parqueaderos/:id/asignaciones` | los bienes comunes y a qué horas abren; los cupos y quién tiene derecho a cada uno |
| `porteria` | `/casilleros` `/encomiendas` `/invitados` `/vehiculos` `/bicicletas` | la casilla de cada unidad, lo que llega y quién lo retira, a quién autorizó cada unidad |
| `reservas` | `/espacios-reservables` `/politicas-reserva` `/reservas` | qué se puede apartar, con qué reglas, y quién apartó |
| `roles` | `/roles` `/modulos` | qué puede hacer cada cargo. **Cada conjunto crea y administra los suyos** |
| `plataforma` | `/usuarios-plataforma` | el equipo de Vecii y su acceso a todos los conjuntos |

**RBAC por permisos.** Módulos → permisos → roles → asignaciones. Los roles de
propietario y residente **se derivan** de `usuarios_unidades`, no se otorgan.

**Concurrencia resuelta en reservas.** `pg_advisory_xact_lock` por espacio, dentro
de la misma transacción que inserta.

---

## El hueco se cerró

**Las 23 tablas tienen API.** Ya no queda nada que solo se pueda cargar a mano en
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

1. **La interfaz.** `apps/vecii` es la plantilla de Expo con una pantalla de
   login. Hoy los 82 endpoints solo se usan desde Swagger, así que ningún
   conjunto puede usar esto todavía, por bien modelado que esté.
2. **Comunicación.** No hay ningún canal de aviso en todo el backend: el estado
   `NOTIFICADA` de una encomienda cambia la fila y no le avisa a nadie. De esto
   dependen cosas que ya están construidas.
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
