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
| Coeficiente confiable por unidad | ⚠️ hoy tiene `@default(0)` — ver pendientes |
| Que los coeficientes sumen 100% | ❌ sin validar |
| Segundo coeficiente para expensas sectoriales | ❌ no existe |
| Presupuesto que apunte a conjunto **o** a agrupación | ❌ no existe |
| Saldo por unidad, no por persona | ❌ no existe |
| Sin `DELETE` en registros contables | ❌ por definir |

## Dónde está la oportunidad de producto

Si el sistema **siempre** calcula `presupuesto × coeficiente`, un administrador
queda impedido de cobrar arbitrariamente, y el residente puede ver la cuenta
completa: presupuesto, su coeficiente, y de dónde sale su cuota.

En un sector donde la desconfianza con la administración es la norma, **la
transparencia verificable es el producto**, no una función más.

Con una condición: hay que soportar los módulos de contribución legítimos. Un
sistema que solo sabe repartir sobre el 100% del conjunto deja por fuera a todos
los conjuntos por etapas.
