# Estado actual

Dónde quedó el proyecto y qué sigue. **Leer esto antes de tocar nada.**
Se actualiza al cerrar cada sesión; si algo aquí ya no es cierto, se corrige.

Última actualización: 6 de septiembre de 2026.

---

## 🔴 Lo primero al abrir una sesión

```powershell
pnpm db:push                                   # aplica el schema y regenera el cliente
pnpm --filter vecii-backend prisma:seed        # siembra permisos y roles
pnpm dev:api                                   # Swagger en http://localhost:3201/docs
```

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
"Unknown argument" que no dice que falta un `db:push`).

---

## Qué hay funcionando

**16 rutas, 69 endpoints.** Todo con Swagger documentado.

| módulo | rutas | qué resuelve |
|---|---|---|
| `auth` | `/auth` | JWT asimétrico de Supabase verificado por JWKS |
| `conjuntos` | `/conjuntos` | la copropiedad y su configuración |
| `estructura` | `/agrupaciones` `/tipologias` `/unidades` | torres y etapas anidadas, plantas, unidades con carga masiva y chequeo de coeficientes |
| `usuarios` | `/usuarios` | registrar personas, quién vive dónde, cerrar vínculos |
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

### El inventario físico no tiene API

Cuatro tablas se cargan a mano, y eso deja módulos completos sin nada contra qué
trabajar:

| tabla | consecuencia |
|---|---|
| `zonas_comunes` + `horarios_zona_comun` | **el salón comunal no se puede ni crear** — hoy un espacio solo puede apuntar a un pool de parqueaderos |
| `parqueaderos` | los cupos V-01…V-50 no existen, así que `POST /reservas/:id/cupo` no tiene qué asignar |
| `asignaciones_parqueadero` | no hay cómo decir "el P-101 es del 501" ni correr el sorteo anual |

**Reservas está completo pero vacío.**

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
- **Las migraciones siguen desfasadas.** Todo se aplicó con `db push`.

---

## Sin empezar

Finanzas (tarifas, cuotas, pagos, estado de cuenta), asambleas y votación por
coeficiente, PQRS y cartelera, el marketplace, y las apps de Expo.

---

## Orden sugerido

1. **Parqueaderos y zonas comunes** — desbloquean lo que ya está construido.
2. **La línea base de migraciones** — lleva en rojo desde el primer día y ya
   costó dos ratos: la conversión de enum a texto no la pudo hacer `db push`.
3. **Control de ingreso** — un botón, no hardware. Desbloquea el cobro real.
4. **Finanzas** — al final, cuando el resto genere los hechos que hay que cobrar.

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
