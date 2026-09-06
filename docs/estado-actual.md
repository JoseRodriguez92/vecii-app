# Estado actual

Dónde quedó el proyecto y qué sigue. **Leer esto antes de tocar nada.**
Se actualiza al cerrar cada sesión; si algo aquí ya no es cierto, se corrige.

Última actualización: 6 de septiembre de 2026.

---

## 🔴 Lo primero al abrir una sesión

El schema tiene un rename sin aplicar a la base. **El proyecto no compila
hasta correr esto:**

```powershell
pnpm db:push
pnpm --filter vecii-backend prisma:seed
```

`db:push` regenera el cliente de Prisma (que hoy todavía dice `Invitacion` y no
`Vinculacion`, que ya no existe), y el seed siembra los códigos de permiso
nuevos — `usuarios.crear*` — y borra los viejos.

`db:push` va a avisar que **borra la tabla `vinculaciones`**. Es correcto:
se eliminó a propósito.

Después, para verificar:

```powershell
cd apps\api
node scripts\verificar-schema.mjs prisma\schema.prisma
npx tsc --noEmit
pnpm dev:api          # Swagger en http://localhost:3201/docs
```

---

## Qué hay construido

**Base de datos:** 22 modelos. Ver `prisma/schema.prisma`, que está comentado a
conciencia — el *por qué* de cada decisión vive ahí, no aquí.

**API con Swagger completo:**

| módulo | tags | estado |
|---|---|---|
| `auth` | `auth` | JWT asimétrico de Supabase por JWKS |
| `conjuntos` | `conjuntos` | listo |
| `estructura` | `estructura · agrupaciones\|tipologias\|unidades` | listo, con carga masiva y chequeo de coeficientes |
| `usuarios` | `usuarios` | listo |
| `porteria` | `porteria · casilleros\|encomiendas\|invitados` | listo |
| `reservas` | `reservas`, `reservas · espacios\|politicas` | listo |

**RBAC por permisos.** Módulos → permisos → roles → asignaciones. Quién puede
qué se edita en la base, no en el código. Al arrancar, la API verifica que todo
permiso declarado exista sembrado y se niega a levantar si falta alguno.

**Sin API todavía** (las tablas existen, los endpoints no): zonas comunes con
sus horarios, parqueaderos y asignaciones de parqueadero. Se cargan a mano.

**Sin modelar:** control de ingreso (entrada/salida), tarifas, finanzas, asambleas.

---

## Dónde nos quedamos: el parqueadero de visitantes

Es el hilo abierto. El caso concreto que se estaba resolviendo:

> Un residente del Torre 1 · apto 501 autoriza a un visitante. El visitante llega
> en carro, portería le asigna un cupo, entra 15:12 y sale 22:12. ¿Cuánto paga el
> 501 y cómo se calcula?

**Hoy el modelo llega hasta la reserva y ahí se corta.** `reservas` guarda que el
501 apartó el pool de visitantes de 15:00 a 21:00. Falta todo lo demás.

### Falta 1 — la tabla `visitas` (portería)

Sin ella no hay hora de entrada, hora de salida, ni qué cupo concreto le tocó
(la reserva apunta al *pool*, no al cupo). Forma propuesta:

| campo | qué es |
|---|---|
| `unidadId` | a quién visita — **y quién paga** |
| `nombre`, `documento`, `placa` | los datos del visitante |
| `autorizadaPorId`, `autorizadaEn` | quién lo dejó entrar y cuándo |
| `reservaId` | null si llegó sin avisar |
| `parqueaderoId` | el cupo que le asignó portería |
| `ingresoEn`, `salidaEn` | los hechos |

Una sola tabla cubre los dos casos: autorizado con anticipación (nace con
`ingresoEn` en null) o llegado de sorpresa (portería crea la fila completa).

### Falta 2 — la tarifa (finanzas)

`politicas_reserva` no tiene plata a propósito: solo lleva lo que se puede
validar sin saber de dinero. La tarifa necesita **vigencia** (`desde`/`hasta`),
porque una visita de marzo se cobra a la tarifa de marzo aunque la asamblea la
haya subido en abril.

Campos propuestos: `valorHora`, `fraccionMinutos` (60 = "por hora o fracción"),
`minutosGratis`, `topeDiario`, `desde`, `hasta`.

El cálculo con el ejemplo de arriba, a $1.500/hora con 2 horas de gracia:

```
420 min − 120 de gracia = 300 min → 5 fracciones × $1.500 = $7.500 al apto 501
```

`visitas` **no** guarda esos $7.500: guarda 15:12 y 22:12. El monto se congela
una sola vez, cuando finanzas emite el cargo — una cuota facturada no puede
cambiar si suben la tarifa después.

### Tres preguntas sin responder

Bloquean el diseño de la tarifa. Son del dueño del producto, no del código:

1. **¿Cobra distinto el que reservó** que el que llegó sin avisar?
2. **¿La gracia es por visita o por mes?** ("dos horas gratis cada vez" vs "diez
   horas al mes por apartamento" — la segunda necesita acumulado.)
3. **¿Existe la visita frecuente?** La empleada que entra todos los días, ¿se
   autoriza una vez o se registra cada día?

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

---

## Pendientes

En [`pendientes.md`](pendientes.md), ordenados por urgencia. Los dos rojos que
más pesan:

1. **Las migraciones no reflejan la base.** Todo el rediseño se aplicó con
   `db push`. Hay que rehacer la línea base antes de que esto crezca más.
2. **Rotar la contraseña de la base de datos**, que se expuso en un chat.

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
