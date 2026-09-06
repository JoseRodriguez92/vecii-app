# ADR-0002: Monolito modular, no microservicios

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team

## Contexto

Al ampliar el alcance de Vecii —gestión del conjunto, portería, marketplace— surgió la propuesta
de partir el backend en varios servicios: uno de autenticación y otro de negocio, con la idea de
que cada aplicación se conectara al que le corresponde.

Situación real al momento de decidir: **un commit en el repositorio, cero usuarios en
producción, un equipo pequeño.**

## Decisión

Un solo backend NestJS, organizado en módulos con fronteras claras:

```
BE/src/modules/
├── conjuntos/     unidades, torres, coeficientes
├── finanzas/      cuotas de administración, pagos
├── seguridad/     visitantes, minutas, autorizaciones de ingreso
├── comunidad/     PQRS, cartelera, reservas de zonas comunes
└── mercado/       perfiles de proveedor, servicios, solicitudes
```

Cada módulo tiene su propio controlador, servicio y DTOs, y no importa servicios de otro módulo
directamente. Cuando dos módulos necesiten hablarse, se hace por una interfaz explícita —no
alcanzando el repositorio del otro.

## Opciones consideradas

### A. Monolito modular — *elegida*

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja — un deploy, una migración, un log |
| Costo | Una instancia |
| Escalabilidad | Vertical primero; suficiente para el horizonte visible |
| Familiaridad del equipo | Es lo que ya está construido |

**A favor:** una transacción de base de datos abarca todo; refactorizar fronteras es mover
carpetas; debugging con un stack trace completo.
**En contra:** todo escala junto; una fuga de memoria en un módulo afecta a los demás.

### B. Microservicios (auth + negocio, o uno por dominio)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta — N deploys, comunicación entre servicios, consistencia eventual |
| Costo | N instancias + observabilidad distribuida |
| Escalabilidad | Mejor en teoría; irrelevante sin carga que lo justifique |
| Familiaridad del equipo | Ninguna |

**A favor:** despliegue y escalado independientes; aislamiento de fallas.
**En contra:** los beneficios de los microservicios son **organizacionales** —equipos que
despliegan sin pisarse—. Con un equipo pequeño se pagan todos los costos y no se cobra ninguno
de los beneficios. El resultado típico es un *monolito distribuido*: el mismo acoplamiento, pero
ahora por la red.

## Análisis de trade-offs

Partir servicios es fácil de hacer y difícil de deshacer. Un monolito con fronteras limpias se
parte cuando haga falta; varios servicios prematuros no se vuelven a juntar.

El detonante para extraer un módulo **no** es que el código crezca. Es uno de estos tres:

1. Un módulo necesita escalar con un perfil distinto al resto
2. Un equipo distinto necesita desplegarlo sin coordinarse
3. Requiere un runtime o cumplimiento que el resto no

Hoy no se cumple ninguno.

## Consecuencias

**Más fácil:** un deploy; transacciones que cruzan módulos sin coreografía; refactorizar
fronteras cuando el dominio se entienda mejor —que es justo lo que va a pasar los próximos meses.

**Más difícil:** hay que ser disciplinado con las fronteras. Sin nadie mirando, en seis meses
`mercado` estará importando el servicio de `finanzas` y la ventaja se pierde.

**A revisar si:** se cumple alguno de los tres detonantes. El primer candidato natural a
extraerse es `mercado`, porque su modelo de datos es global mientras el resto vive aislado por
`conjuntoId` (ver [ADR-0005](0005-marketplace-saberes.md)).

## Tareas

1. [ ] Regla de lint o revisión en PR que impida importaciones cruzadas entre módulos
2. [ ] Documentar en el README del backend cuáles son los tres detonantes de extracción
3. [ ] Al crear cada módulo nuevo, definir su interfaz pública antes que su implementación
