# ADR-0004: Una sola app Expo con route groups

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team

## Contexto

Vecii atiende públicos con necesidades muy distintas: residentes y propietarios por un lado,
porteros por otro. La primera idea fue una aplicación por público —hasta cuatro, contando
comercios y domiciliarios—, cada una en web, Android e iOS.

Dos precisiones que redujeron el problema:

1. **Expo ya entrega las tres plataformas desde un solo código.** Cuatro públicos no son doce
   proyectos; son cuatro como máximo.
2. **Domiciliarios se descartó.** Un repartidor externo no instala una app: lo que necesita es
   que portería lo autorice a entrar, y eso es un flujo dentro de portería.

## Decisión

Una sola app Expo (`apps/vecii`) con **route groups** —carpetas entre paréntesis que no aparecen
en la URL pero permiten un layout propio:

```
apps/vecii/src/app/
├── _layout.tsx            lee el rol y enruta al grupo que corresponde
├── sign-in.tsx
│
├── (conjunto)/            residentes, propietarios, consejo, administración
│   ├── _layout.tsx        tabs: Inicio · Cuotas · Reservas · PQRS
│   └── ...
│
└── (porteria)/            porteros
    ├── _layout.tsx        botones grandes, alto contraste, uso de noche
    └── ...
```

Cada grupo tiene su propio `_layout.tsx`, así que las dos interfaces pueden verse y comportarse
de forma completamente distinta dentro de la misma app. El `Stack.Protected` que ya existe en el
layout raíz se extiende: hoy pregunta *"¿hay sesión?"*, pasará a preguntar *"¿y qué rol?"*.

## Opciones consideradas

### A. Una app con route groups — *elegida*

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja — un proyecto, un build, una configuración |
| Costo | Una ficha por tienda |
| Time to market | El más rápido |

**A favor:** el código compartido lo es por defecto; una sola configuración de Metro y EAS; un
usuario que es residente *y* portero no cambia de app.
**En contra:** ciclo de release compartido.

### B. Una app por público

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta — N proyectos, N configuraciones, N pipelines |
| Costo | N fichas de tienda, N revisiones de Apple |
| Time to market | El más lento |

**A favor:** cada app se despliega y se bloquea por separado; el dispositivo de portería no
carga el código de residentes.
**En contra:** desproporcionado para el tamaño actual del equipo y del producto.

## Análisis de trade-offs

La razón inicial para separar portería era real: es un dispositivo compartido, en modo kiosco,
con sesión que no se cierra y que debe funcionar con mala red. Revisado punto por punto, casi
todo se resuelve igual dentro de una sola app —el modo kiosco se activa a nivel de dispositivo,
el escáner es una librería, lo offline se resuelve por ruta.

Queda **un** costo que no se puede esquivar: **comparten ciclo de release**. Un arreglo en
portería obliga a volver a publicar toda la app y a pasar de nuevo por revisión de Apple.

Ese costo se acepta hoy porque la decisión no se cierra: como `(porteria)/` ya vive en su propia
carpeta con su propio layout, extraerla a una app aparte el día que duela es un trabajo acotado,
no un rediseño.

Aparte, no las tres interfaces necesitan tienda pública:

| Interfaz | Distribución | ¿Tienda? |
|---|---|---|
| Conjunto | Pública | Sí — App Store y Play |
| Portería | La tablet de la portería, distribución interna | No |

## Consecuencias

**Más fácil:** un solo proyecto que configurar y mantener; la sesión y el cliente de API se
comparten sin esfuerzo.

**Más difícil:** un bug en portería obliga a re-publicar toda la app; el bundle incluye código
que un porter nunca usa.

**A revisar si:** portería necesita un ciclo de release propio, o el bundle crece hasta afectar
el arranque. Detonante concreto: la primera vez que una revisión de Apple retrase un arreglo
urgente de portería.

## Tareas

1. [ ] Reorganizar `src/app/` en los grupos `(conjunto)` y `(porteria)`
2. [ ] Extender el `_layout.tsx` raíz para enrutar según el rol del JWT
3. [ ] Definir a dónde va un usuario con roles en ambos grupos —¿selector, o el rol de mayor privilegio?
4. [ ] Layout propio de portería: tipografía grande, alto contraste, pensado para uso nocturno
