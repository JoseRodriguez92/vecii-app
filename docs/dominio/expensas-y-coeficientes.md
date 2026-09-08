# Expensas y coeficientes

Conocimiento de dominio, no decisiones. Lo que hay que entender de propiedad
horizontal colombiana **antes** de escribir la primera tabla de finanzas.

> ⚠️ Estas notas las escribió un agente a partir de la Ley 675 de 2001 y de la
> práctica común del sector. **No son concepto legal.** Antes de que esto llegue
> a producción —sobre todo intereses de mora y cobro persuasivo— hay que pasarlo
> por un abogado.

## El coeficiente de copropiedad

Porcentaje de participación de cada unidad privada dentro de la copropiedad.
Todos los coeficientes de un conjunto suman **100%**.

Define **tres** cosas, no una:

1. **Cuánto paga** de las expensas comunes
2. **Cuánto pesa su voto** en la asamblea — se vota por coeficiente, no por cabeza,
   y el quórum se mide igual
3. **Cuánto le pertenece** de los bienes comunes

Sale del **reglamento de propiedad horizontal**, que es escritura pública
registrada. Se calcula principalmente sobre el área privada, y el reglamento
puede considerar destinación y ubicación. **El administrador no lo define ni lo
cambia**: modificarlo exige reformar el reglamento. Para Vecii es un dato que se
carga, nunca uno que se calcula.

## La cuota

```
presupuesto del periodo  ×  coeficiente de la unidad  =  cuota
```

La **tipología no aparece** en esta cuenta. Un edificio viejo sin ninguna
tipología se factura perfecto: solo hacen falta los coeficientes.

## Los módulos de contribución

Es el segundo reparto, y tiene nombre legal propio. **No se dice "coeficiente
sectorial"** aunque todo el mundo lo diga: la Ley 675 lo llama *módulo de
contribución* y lo define en el artículo 3 como los

> índices que establecen la participación porcentual de los propietarios de
> bienes de dominio particular, en las expensas causadas en relación con los
> bienes y servicios comunes cuyo uso y goce corresponda a **una parte o sector
> determinado** del edificio o conjunto.

La diferencia con el coeficiente, en una línea:

| | reparte | sobre | ejemplo |
|---|---|---|---|
| **Coeficiente de copropiedad** | las expensas **comunes** | el conjunto entero | vigilancia, administración, aseo |
| **Módulo de contribución** | las expensas de **un sector** | solo las unidades de ese sector | los dos ascensores de la Torre B |

El caso que lo explica solo: un conjunto de casas más una torre con ascensores.
Si todo se repartiera por coeficiente, **las casas estarían pagando un ascensor
que no pueden usar**. El módulo existe para que ese gasto lo asuman únicamente
las unidades de la torre, y entre ellas siga siendo proporcional — dentro del
sector tampoco se divide por partes iguales.

### Quién los crea

**El reglamento de propiedad horizontal**, que es escritura pública. No la
asamblea por su cuenta, y muchísimo menos el administrador. Si el reglamento no
los prevé, **no se pueden aplicar**.

Y hay una regla de destinación que conviene citarle textual a un administrador,
porque es la que evita el abuso más común: los recursos de cada sector *"solo
podrán sufragar las erogaciones inherentes a su destinación específica"*
(art. 31). La plata del sector comercial no paga el parque infantil.

### El matiz que hay que verificar antes de prometerlo

El artículo 31 hace la sectorización **obligatoria en edificios de uso comercial
o mixto**: esos reglamentos "deberán prever de manera expresa la sectorización de
los bienes y servicios comunales".

Para **conjuntos residenciales por etapas** la cosa no es tan clara. En la
práctica se usa muchísimo —la piscina de la Etapa 1 cobrada solo a la Etapa 1— y
hay fuentes que sostienen que los módulos son propios del uso comercial y mixto,
no del residencial.

> ⚠️ **Esto hay que confirmarlo con un abogado antes de ofrecérselo a un
> conjunto residencial como funcionalidad.** Es la clase de promesa que un
> administrador repite en una asamblea, y si está mal, el que queda mal es él.

### Qué significa para el modelo

Aquí está el error que ya cometimos una vez y conviene no repetir: **un módulo
de contribución no es "un segundo coeficiente" en la tabla de unidades.** Una
misma unidad puede estar en varios a la vez —el ascensor de su torre *y* la
piscina de su etapa— así que una columna extra solo aguantaría uno.

Son dos tablas: los sectores que el reglamento definió, y cuánto le corresponde a
cada unidad en cada uno. Como son tablas nuevas y no cambian las que existen,
**no bloquean nada**: su lugar natural es junto a finanzas, que es quien las va a
usar.

## Qué se puede variar y qué no

**Se puede, si está en el reglamento:**

- **Módulos de contribución** — que ciertos gastos los paguen solo algunas
  unidades: el ascensor solo a las torres que lo tienen, la piscina de la Etapa 1
  solo a esa etapa (*expensas sectoriales*)
- Coeficientes que consideran destinación o ubicación además del área

**No se puede:**

- Que el administrador decida por su cuenta cobrar más o menos a alguien
- Exonerar a un copropietario. **Se paga aunque el apartamento esté vacío y
  aunque el dueño nunca use la piscina**: la obligación nace de ser propietario,
  no de usar
- Intereses de mora por encima del tope legal

Y la aritmética no perdona: cobrarle de menos a uno es cobrarle de más a todos,
porque el presupuesto no se reduce solo.

## La deuda va pegada al inmueble

La obligación de pagar expensas es **real** (*propter rem*): sigue al inmueble,
no a la persona. Quien compra un apartamento con dos años de mora **compra
también la deuda**.

> **Consecuencia directa para el modelo: el saldo cuelga de la `Unidad`, no del
> propietario.** Cuando el 501 cambia de dueño, la deuda se queda en el 501.

## Lo que esto le exige al modelo

| Necesidad | Estado |
|---|---|
| Coeficiente confiable por unidad | ✅ es `Decimal?` — `null` significa "no cargado", ya no se confunde con cero |
| Que el sistema se niegue a facturar con coeficientes en `null` | ✅ `problemaAlRepartir`, con pruebas |
| Que los coeficientes sumen 100% | ✅ misma función, tolerancia 0.0001 |
| Sectores y módulos de contribución | ✅ `sectores` y `unidades_sectores` |
| Presupuesto que apunte a conjunto **o** a agrupación | ⏸ **aplazado**: hoy el administrador manda el valor a repartir. Ver [ADR-0008](../adr/0008-cobranza.md) |
| Saldo por unidad, no por persona | ✅ `cuentas_cobro.unidad_id`. El saldo se **deriva** |
| Sin `DELETE` en registros contables | ✅ los pagos se **anulan** con motivo; los conceptos se desactivan |

## Dónde está la oportunidad de producto

Si el sistema **siempre** calcula `presupuesto × coeficiente`, un administrador
queda impedido de cobrar arbitrariamente, y el residente puede ver la cuenta
completa: presupuesto, su coeficiente, y de dónde sale su cuota.

En un sector donde la desconfianza con la administración es la norma, **la
transparencia verificable es el producto**, no una función más.

Con una condición: hay que soportar los módulos de contribución legítimos. Un
sistema que solo sabe repartir sobre el 100% del conjunto deja por fuera a los
conjuntos de uso mixto —donde la ley los exige— y a los conjuntos por etapas, que
en la práctica los usan.

**Fuentes**
- [Ley 675 de 2001, art. 31 — Sectores y módulos de contribución](https://leyes.co/el_regimen_de_propiedad_horizontal/31.htm)
- [Ley 675 de 2001, art. 51 — funciones del administrador](https://leyes.co/el_regimen_de_propiedad_horizontal/51.htm)
- [Gerencie.com — expensas comunes y módulos de contribución](https://www.gerencie.com/pago-de-cuotas-y-expensas-necesarias-en-la-propiedad-horizontal.html)
- [leydepropiedadhorizontal.org — módulos de contribución](https://leydepropiedadhorizontal.org/modulos-contribucion-propiedad-horizontal/)
