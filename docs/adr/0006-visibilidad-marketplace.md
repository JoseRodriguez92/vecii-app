# ADR-0006: Visibilidad del marketplace y protección de la identidad

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team
**Relacionado:** [ADR-0005](0005-marketplace-saberes.md)

## Contexto

El [ADR-0005](0005-marketplace-saberes.md) definió que el marketplace es **global dentro de la
red Vecii**: todos los conjuntos se ven entre sí. Quedó sin resolver algo distinto: **qué se ve
desde afuera**, sin haber iniciado sesión.

La motivación es de crecimiento. La landing puede mostrar la oferta real de la red —"50
electricistas, 400 pintores, 20 psicólogos"— como prueba de que la plataforma está viva, y llevar
a quien haga clic hacia la aplicación.

El riesgo es que un perfil de proveedor combina dos datos que por separado son inocuos y juntos
no lo son: **quién eres** y **dónde vives**.

## Decisión

### Tres niveles de datos, no dos

| Nivel | Qué contiene | Quién lo ve |
|---|---|---|
| **Conjunto** | cuotas, unidades, visitantes, reservas | solo ese conjunto |
| **Red** | perfiles, servicios, reseñas | cualquier usuario autenticado |
| **Público** | conteos por categoría y ciudad | internet |

### Lo público son agregados, nunca personas

La landing consume un único endpoint marcado con `@Public()` que devuelve **conteos por
categoría y ciudad**. Ningún nombre, ninguna foto, ningún contacto, ninguna URL de perfil
indexable.

### El proveedor se presenta con un nombre comercial, no con su identidad

El perfil tiene un `nombrePublico` —"Mis Terapias", "Pinturas del Norte"— y **eso es lo único
que ve el resto de la red**. El nombre legal de la persona, su torre y su apartamento viven en
`Usuario` y no se muestran en ninguna pantalla del marketplace.

```
PerfilProveedor
  ├─ nombrePublico   "Mis Terapias"      ← lo único visible
  └─ usuarioId ───►  Usuario             ← identidad real, nunca expuesta
```

No es solo privacidad: entregarle a un desconocido el conjunto, la torre y el apartamento de una
persona es un riesgo de seguridad física, y en el contexto colombiano es un riesgo que no
corresponde asumirle al usuario.

### El apartamento no se muestra nunca, a nadie

Sin capas ni excepciones, ni siquiera a vecinos del mismo conjunto. El contacto ocurre por
mensajería dentro de la aplicación; nadie necesita una unidad para contratar un servicio. El
número de apartamento pertenece al dominio del conjunto —administración y portería lo
necesitan— y ahí se queda.

### La insignia es relacional, no descriptiva

| Quién mira | Qué ve |
|---|---|
| Alguien del mismo conjunto | **Mis Terapias** · ✓ *Vive en tu conjunto* |
| Alguien de otro conjunto | **Mis Terapias** · ✓ *Residente verificado · Bogotá* |
| Internet | solo el conteo de la categoría |

La primera fila no revela ningún dato: quien mira ya sabe en qué conjunto vive. Se entrega la
señal de confianza —la ventaja que ningún marketplace general puede replicar— sin entregar
información nueva.

### Anónimo para los usuarios, identificado para Vecii

El proveedor es anónimo frente a la red, nunca frente a la plataforma. El perfil siempre cuelga
de un `Usuario` verificado, de modo que ante un fraude o una queja hay a quién responsabilizar.
Esto es política, no detalle de implementación, y debe quedar en los términos de uso.

### Las solicitudes son privadas, siempre

Una solicitud es visible únicamente para las dos partes. Ni el administrador del conjunto ni
nadie más. En categorías sensibles —salud, psicología, asuntos legales— tampoco habrá reseñas
públicas: quién contrató a quién no puede quedar expuesto.

## Opciones consideradas

### A. Nada real en público

Categorías genéricas de adorno en la landing. Seguro, pero no convence: parece una promesa vacía
y no aporta nada a búsquedas.

### B. Agregados públicos, personas solo dentro — *elegida*

**A favor:** prueba social real; posicionamiento por categoría y ciudad; cero exposición de datos
personales.
**En contra:** un proveedor no llega por búsqueda de su nombre.

### C. Perfiles públicos indexables

**A favor:** el mayor alcance posible; cada proveedor atrae tráfico.
**En contra:** publica que una persona identificable vive en un edificio concreto. En el contexto
colombiano de seguridad eso es un riesgo material para el usuario, creado por nosotros. Se
descarta.

Si en el futuro se quieren perfiles públicos, tendrán que ser **opt-in explícito y sin revelar el
conjunto** —ciudad como máximo.

## Análisis de trade-offs

Se cambia alcance de búsqueda por seguridad del usuario, y es un cambio que vale la pena: el
activo de Vecii es la confianza. Un solo incidente en que alguien use la plataforma para ubicar a
un residente destruye más valor del que cualquier posicionamiento pueda construir.

La opción B conserva casi todo el beneficio de crecimiento —los agregados y las categorías por
ciudad son buen contenido indexable— sin ninguna de las consecuencias.

## Consecuencias

**Más fácil:** la landing tiene contenido real que mostrar; el marketplace gana tráfico
cualificado; los proveedores no tienen que exponerse para participar.

**Más difícil:**
- Aparece una tercera clasificación de datos, y es la más peligrosa: un error de aislamiento
  entre conjuntos se lo muestras a un vecino equivocado; un error aquí se lo muestras a Google.
- Hay que preservar el destino a través del login. Si alguien llega buscando electricista y
  después de autenticarse aterriza en el inicio, se perdió la conversión.
- Cada campo nuevo del perfil obliga a decidir en qué capa vive. Sin una regla escrita, el
  teléfono termina en el listado.

**A revisar si:** el posicionamiento resulta insuficiente para atraer conjuntos nuevos, o si los
proveedores piden visibilidad pública. Ahí se evalúa el opt-in sin conjunto.

## Tareas

1. [ ] `GET /api/publico/categorias` con `@Public()` — solo conteos por categoría y ciudad
2. [ ] Consumir ese endpoint desde la landing con revalidación estática
3. [ ] Redirección a `app.vecii.com/mercado?cat=<categoria>` conservando el destino tras el login
4. [ ] `nombrePublico` obligatorio y único en `PerfilProveedor`; validar contra suplantación
5. [ ] Ninguna consulta del marketplace puede seleccionar torre, unidad, nombre legal ni contacto
6. [ ] Insignia relacional: comparar el conjunto de quien mira con el del proveedor
7. [ ] Mensajería interna, para que el teléfono nunca sea obligatorio
8. [ ] Marcar categorías sensibles y desactivar reseñas públicas en ellas
9. [ ] Prueba automatizada: un usuario sin sesión no lee ningún dato personal
10. [ ] Prueba automatizada: ninguna respuesta del marketplace incluye unidad ni nombre legal
11. [ ] Moderación de nombres comerciales antes de la apertura pública
