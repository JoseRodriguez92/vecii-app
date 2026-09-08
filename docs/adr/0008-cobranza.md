# ADR-0008: Cómo se le cobra a una unidad

**Estado:** Aceptada
**Fecha:** 2026-09-08
**Deciders:** Web Team
**Relacionado:** [expensas y coeficientes](../dominio/expensas-y-coeficientes.md)

## Contexto

Finanzas es el módulo más grande del sistema y el que menos perdona: un error en
reservas es una molestia, uno acá es plata mal cobrada y un administrador que
pierde la confianza.

El primer borrador que se propuso tenía ocho tablas y mezclaba niveles —procesos
y valores listados junto a tablas—. Discutiéndolo con filas reales quedó en
cinco, y varias decisiones cambiaron por el camino. Este ADR las fija para no
volver a discutirlas.

## Decisión

### El modelo, en cinco tablas

```
conceptos_cobro  →  cobros  →  cuentas_cobro  ←  imputaciones  ←  pagos
   (el catálogo)    (líneas)   (lo que se paga)  (qué cubrió qué)  (lo que entró)
```

Más `sectores` y `unidades_sectores`, que son el **segundo reparto** y viven en
estructura porque los usa el reglamento, no la cobranza.

### El concepto no es el cobro

Es la misma diferencia que entre `tipologias` y `unidades`: el catálogo tiene
cinco filas para siempre, los cobros crecen todos los meses. El cobro guarda **el
valor que se cobró**, no una referencia al precio de hoy: si mañana sube el
salón, la cuenta de septiembre sigue diciendo lo que se cobró.

Tres conceptos los genera el sistema y llevan `codigo` —`ADMINISTRACION`,
`INTERES_MORA`, `CUOTA_EXTRAORDINARIA`—; el resto los inventa el conjunto y no
llevan código, igual que un cargo inventado. Se siembran al crear el conjunto,
en la misma transacción.

**Un descuento es `naturaleza: ABONO`, no un valor negativo.** Un valor negativo
obliga a acordarse del signo en cada suma; la naturaleza lo dice una vez.

### Se paga la cuenta, no la línea

Nadie elige pagar solo el parqueadero. Si se dejara elegir, todos pagarían lo
nuevo y la deuda vieja envejecería sola.

Por eso la imputación es **a nivel de cuenta**, y la regla es **la más vieja
primero**. Eso además simplifica la imputación legal: los intereses ya vienen
adentro de cada cuenta como una línea más, así que no hace falta la regla del
Código Civil (art. 1653, primero intereses) en el camino principal — queda de
respaldo para los casos raros.

### La imputación no es plata que sale

Es la anotación de a qué deuda se aplicó la que entró. Hace falta porque **un
pago casi nunca corresponde a una sola cuenta**: quien se pone al día cubre
julio, agosto y parte de septiembre con un solo pago.

### La cuenta se emite a la unidad PRINCIPAL

Comprar el apto 501 es comprar tres unidades —el apartamento, el parqueadero 34
y el depósito 12—, pero llega **un** recibo. La facturación recorre las unidades
con `unidad_principal_id` en null y agrega una línea por cada accesoria.

Si recorriera todas, a esa familia le llegarían tres recibos: justo lo que la
unidad accesoria existe para evitar.

### Generar y emitir son dos actos

| | qué hace |
|---|---|
| **Generar** | calcula y deja borradores. **No le avisa a nadie** |
| **Emitir** | los muestra, fija el vencimiento y avisa por la campanita |

En el medio el administrador revisa —la cuota subió porque subió el presupuesto,
este dato quedó mal— y puede volver a generar sin consecuencias. Lo ya emitido no
se toca: ahí afuera hay gente que ya vio esa cuenta.

**No hay tarea programada que emita sola.** Facturarle a mil conjuntos a
medianoche es cobrarle mal a mucha gente al mismo tiempo y enterarse al otro día.
Es un acto administrativo: alguien tiene que mirar antes.

Volver a generar reemplaza **solo** los cobros de administración. Una multa o el
alquiler del salón los puso una persona y no los borra un recálculo.

### Nada derivado se guarda

Ninguna tabla tiene `total`, `saldo` ni `estado`. Solo dos fechas en la cuenta:

| pregunta | cómo se responde |
|---|---|
| ¿cuánto vale? | se suman sus cobros (los `ABONO` restan) |
| ¿cuánto debe? | cobros − imputaciones |
| ¿está en borrador? | `emitida_en` es null |
| ¿está vencida? | `vence_el` < hoy **y** saldo > 0 |
| ¿está pagada? | saldo = 0 |

Un `pagado: boolean` se contradice solo en cuanto llega un abono parcial, un pago
cubre tres meses, o rebota un cheque. Es la misma razón por la que se borró
`zonas_comunes.reservable`.

El precio: `soloPendientes` filtra **después** de calcular, no en el `WHERE`. Es
barato y se paga con no tener dos versiones de la verdad.

### El reparto suma exactamente el monto

`reglas-reparto.ts`, función pura con 12 pruebas. Multiplicar y redondear cada
parte por separado deja el total unos pesos corrido —**todos los meses**— y el
presupuesto no cierra sin que nadie sepa por qué.

Se usa el **método del resto mayor**: cada unidad recibe la parte entera, y los
pesos sobrantes van de a uno a las que quedaron con la fracción decimal más
grande. El desempate por coeficiente y después por id lo vuelve determinista: dos
corridas del mismo mes dan idéntico.

Y **se niega a facturar** si a alguna unidad le falta el coeficiente o si no
suman 100%. Repartir así hace que las demás paguen de más, y eso solo se
descubre cuando falta la plata.

### Cerrar, no borrar

No hay `DELETE` en nada contable. Un pago que rebotó se **anula con motivo** —un
`CHECK` exige que las dos cosas vayan juntas—; un concepto que ya no se usa se
**desactiva**, porque los cobros de 2026 lo siguen nombrando.

## Lo que se aplazó, y por qué

### El presupuesto no se modela todavía

El presupuesto es la suma de lo que cuesta operar el conjunto —vigilancia, aseo,
honorarios, seguros, fondo de imprevistos— y lo aprueba la asamblea. **No se
deduce del número de unidades**: la relación va al revés, el presupuesto se
reparte entre ellas.

Hoy el administrador manda `valorARepartir` al generar. Modelarlo entero sirve
para responder *"¿por qué subió mi cuota?"* y para comparar presupuesto contra
ejecución, pero eso es **contabilidad, no cobranza**, y se puede agregar después
sin tocar nada de lo que ya existe.

*(Dato para la venta: Vecii aparece como una línea de ese presupuesto. Y el
presupuesto lo aprueba el consejo o la asamblea — así que la venta no termina en
el administrador, y los presupuestos se aprueban entre noviembre y marzo.)*

### Los impuestos quedan fuera

Las expensas de una copropiedad residencial normalmente no llevan IVA —es una
persona jurídica sin ánimo de lucro— pero en uso comercial o mixto la cosa
cambia. Hay un campo opcional en el concepto y **cero motor tributario**. Esa la
resuelve un contador.

## 🔴 Lo que sigue SIN decidir

**¿Vecii recauda la plata, o solo registra lo que el conjunto ya cobró?**

Es la decisión que más cambia el alcance y todavía no está tomada. El modelo hoy
asume **registrar**: `MedioPago` incluye `PASARELA`, pero nadie mueve plata —
Vecii anota.

| | qué implica |
|---|---|
| **Solo registra** | la plata entra a la cuenta del conjunto. Sin pasarela, sin responsabilidad sobre plata ajena. El 90% del valor con el 10% del problema |
| **Vecii recauda** | pasarela, PSE, conciliación, retenciones, contratos con bancos. Agrega una línea de ingreso (comisión) y multiplica el alcance y el riesgo |

Una preferencia expresada en la conversación: si hay pasarela, **no ofrece pagos
parciales** — se paga la cuenta completa. Eso es política y está bien; pero el
**modelo tiene que poder registrar un parcial igual**, porque la vida los produce
(consignación en el banco, acuerdos de pago, intereses que corren mientras se
paga). Si no, el administrador termina llevando esos casos en Excel — y ahí se
perdió, porque volvió al Excel del que se lo quería sacar.

Hay que cerrarla antes de construir el registro de pagos.
