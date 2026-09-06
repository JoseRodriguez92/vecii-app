# ADR-0005: Marketplace de saberes entre residentes

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team

## Contexto

Vecii incluirá un marketplace. La primera formulación era "comercios", entendidos como negocios
—locales del conjunto y tiendas del barrio—, lo que abría un problema serio: un negocio externo
no pertenece a ningún conjunto, y todo el aislamiento de datos del sistema cuelga de
`conjuntoId`.

Al precisarlo, resultó ser otra cosa: **un vecino que ofrece sus saberes**. El ingeniero de
software del 302, el pintor del 5B, el electricista de la Torre 2.

Eso cambia el problema por completo. Un vecino **sí** pertenece a un conjunto: ya tiene
`Usuario`, ya tiene `Membresia`. No hace falta una identidad nueva.

## Decisión

**Alcance de la v1:**

- Proveedores: **solo residentes** con membresía activa en algún conjunto
- Visibilidad: toda la red Vecii, con filtros por cercanía
- **Sin pagos.** El marketplace conecta; la transacción ocurre por fuera
- Las tiendas de barrio y los proveedores externos quedan **aplazados**

**Ser proveedor no es ser otro usuario**: es activar una capacidad sobre el usuario que ya se es
—como pasar de huésped a anfitrión sin crear otra cuenta.

```
Usuario  (ya existe)
   └─ PerfilProveedor        0..1, opcional
         ├─ ciudad / zona    el alcance real es geográfico, no por conjunto
         ├─ verificaciones   identidad, residencia → la insignia
         ├─ Servicio[]
         ├─ Solicitud[]
         └─ Reseña[]
```

Vive como un tercer route group, `(mercado)/`, en la misma app —no en una aplicación aparte:
el descubrimiento ocurre en contexto. Son las 8pm, se dañó una toma, y el residente abre la app
donde ya paga su cuota.

## Opciones consideradas

| Opción | Qué produce |
|---|---|
| Toda la red + **solo residentes** — *elegida* | Un directorio de residentes verificados de conjuntos administrados. Nadie más tiene esa base de datos |
| Por conjuntos + residentes y externos | El proveedor **aprobado por la administración**. También defendible: la administración responde por él |
| Toda la red + residentes y externos | Un marketplace de servicios genérico, compitiendo con Facebook Marketplace y los grupos de WhatsApp del barrio, sin ninguna ventaja propia |
| Solo mi conjunto | Máxima confianza, mercado diminuto: en 80 apartamentos casi nadie necesita un ingeniero de software hoy |

## Análisis de trade-offs

La ventaja de Vecii sobre cualquier marketplace general es que **sabe quién vive dónde**. Abrir
el marketplace a cualquiera regala esa ventaja; cerrarlo a un solo conjunto lo deja sin demanda.

La combinación elegida conserva las dos cosas: la red es grande, pero todos los que están dentro
son residentes verificados de edificios administrados. La verificación no es un trámite: **es el
producto**.

**Sobre los pagos.** Si Vecii cobra y le paga al proveedor, entra en facturación, comisiones,
devoluciones y —en Colombia— probablemente en terreno de intermediación con peso regulatorio.
Aplazarlo no es solo prudencia legal: sin datos reales de qué se transa, cualquier diseño de
pagos sería adivinanza. *(Esto requiere concepto legal antes de implementarse, no criterio
técnico.)*

**Advertencia de alcance.** Un marketplace es un producto de dos lados, con sus propios
problemas duros: suficientes proveedores para que valga buscar, suficientes clientes para que
valga ofrecer, confianza, disputas. La gestión del conjunto es lo que hace que un administrador
**pague** por Vecii; el marketplace es lo que hace que los residentes la **abran a diario**. Los
dos importan, pero construidos al tiempo no se entrega ninguno.

Por eso: **se modela ahora, se construye después.** Dejar el schema previsto no cuesta nada hoy
y evita un retrofit caro más adelante.

## Consecuencias

**Más fácil:** no hay identidad nueva, ni tabla de usuarios aparte, ni autenticación adicional;
la insignia de residente verificado sale gratis de datos que ya existen.

**Más difícil —y esto es lo importante:** la base de datos pasa a tener **dos dominios con
reglas de seguridad opuestas**.

| Dominio | Tablas | Aislamiento |
|---|---|---|
| Conjunto | cuotas, unidades, visitantes, reservas | **Estricto** por `conjuntoId` |
| Marketplace | perfiles, servicios, reseñas | **Global**, visible entre todos |

`RolesGuard` asume hoy que toda petición pasa por `x-conjunto-id`; necesita un segundo eje para
las rutas de marketplace. Y las políticas de RLS en Supabase serán distintas por grupo de
tablas: equivocarse ahí significa que un residente lea las cuotas de otro conjunto.

Aparece además un costo que no es de código: **moderación**. Perfiles falsos, spam y disputas
son trabajo de personas.

**A revisar cuando:** haya demanda probada. Ahí se decide si entran las tiendas de barrio —con
el problema de identidad externa, pero ya con datos— y si Vecii toca la plata.

## Tareas

1. [ ] Modelar `PerfilProveedor`, `Servicio`, `Solicitud` y `Reseña` en el schema de Prisma
2. [ ] Definir el segundo eje de autorización para rutas globales, sin `x-conjunto-id`
3. [ ] Separar las políticas de RLS por dominio y documentar cuál aplica a cada tabla
4. [ ] **No construir la interfaz** hasta que cuotas, reservas y portería estén funcionando
