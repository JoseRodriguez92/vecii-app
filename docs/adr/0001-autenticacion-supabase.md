# ADR-0001: La autenticación la hace Supabase, no nosotros

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team

## Contexto

Vecii tendrá varias interfaces: la app del conjunto, la de portería, el marketplace y la
landing. Surgió la propuesta de construir un servicio de autenticación propio en NestJS —uno
que emitiera el JWT y verificara el rol— con el argumento de que *"si vamos a tener varias
aplicaciones, es mejor que haya un solo auth"*.

El objetivo es correcto: una identidad única para todas las superficies. El mismo señor que es
propietario del 302 y además ofrece sus servicios en el marketplace no puede terminar con dos
cuentas.

El punto es que el proyecto **ya usa Supabase**, y Supabase Auth ya es exactamente ese servicio.

## Decisión

Separamos dos conceptos que se confunden con facilidad:

- **Autenticación** (*¿quién eres?*) → **Supabase Auth**. Login, contraseñas, refresh del
  token, recuperación de cuenta, MFA si algún día hace falta.
- **Autorización** (*¿qué puedes hacer?*) → **la API NestJS**. Roles, membresías, permisos por
  conjunto.

No se construye un servicio de auth propio. Las tres apps apuntan al **mismo proyecto Supabase**
—no a tres proyectos—, y eso es lo que hace que la identidad sea única.

Adicionalmente, las membresías y roles se inyectarán en el JWT mediante el
[Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
de Supabase, para que la API no tenga que consultar Postgres en cada petición.

### Los tokens se verifican contra el JWKS, no con un secreto compartido

Supabase migró a **JWT Signing Keys** asimétricas. Los access tokens se firman con ES256 / RS256
y se verifican contra el JWKS público del proyecto:

```
GET ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

El "Legacy JWT secret" que el panel todavía muestra **ya no firma los tokens de los usuarios**:
sobrevive solo para validar las antiguas llaves `anon` y `service_role`, que este proyecto no
usa —se reemplazaron por las llaves `publishable` y `secret`, y las legacy se apagan a fines de
2026—. Configurar el backend con ese secreto habría hecho que todos los inicios de sesión
respondieran 401.

En consecuencia se retiró Passport (`@nestjs/passport`, `passport-jwt`) y la verificación pasó a
`jose`, que es lo que Supabase documenta. `createRemoteJWKSet` cachea las llaves públicas y las
vuelve a pedir cuando aparece un `kid` desconocido, así que la rotación se resuelve sin
intervención.

## Opciones consideradas

### A. Supabase Auth + autorización en la API — *elegida*

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja — ya está funcionando |
| Costo | Incluido en Supabase |
| Escalabilidad | Suficiente por mucho tiempo |
| Familiaridad del equipo | Ya implementado en `BE/src/auth/` |

**A favor:** cero código nuevo; recuperación de contraseña, refresh y MFA vienen resueltos; una
sola identidad por construcción.
**En contra:** dependencia de un proveedor; los claims custom tienen límites de forma.

### B. Servicio de auth propio en NestJS, delante de Supabase

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta — un deploy más, un salto más |
| Costo | Infraestructura + mantenimiento |
| Escalabilidad | Peor: punto único de falla para *todas* las apps |
| Familiaridad del equipo | Habría que construirlo |

**A favor:** control total sobre el formato del token.
**En contra:** no centraliza nada que no esté ya centralizado —por dentro llamaría a Supabase
igual—. Si se cae, caen las tres apps en vez de una. Latencia extra en cada petición.

### C. Auth propio reemplazando Supabase

Descartada de entrada. Implementar correctamente hashing, rotación de tokens, recuperación de
cuenta y protección contra fuerza bruta es un proyecto en sí mismo, y hacerlo mal es la clase de
error que no se nota hasta que es tarde.

## Análisis de trade-offs

La opción B parece que centraliza, pero en realidad **agrega un intermediario a algo que ya
estaba centralizado**. Tres apps apuntando al mismo proyecto Supabase ya comparten identidad; no
hace falta nada en el medio.

El costo real de A es la dependencia de Supabase. Es una dependencia asumible: si algún día hay
que migrar, lo que se reemplaza es el emisor de tokens, y la API seguiría validando un JWT igual
—solo cambia de dónde viene.

## Consecuencias

**Más fácil:**
- Una identidad para todas las apps sin escribir una línea.
- Con el hook de claims, la API deja de consultar Postgres en cada petición para resolver el rol.

**Más difícil:**
- Los claims quedan **congelados hasta que el token se refresque** (~1 hora). Si a alguien se le
  quita el rol de administrador, su token sigue afirmando que lo es hasta el refresh.
- Quedamos atados al formato de JWT de Supabase.

**Mitigación del congelamiento:** expiración corta del token **más** verificación contra la base
de datos en las acciones destructivas o sensibles —autorizar un ingreso, aprobar un gasto,
eliminar registros—. Para lectura y navegación, el claim del token es suficiente.

**A revisar si:** aparece necesidad de SSO empresarial, varios proveedores de identidad, o claims
que Supabase no permita emitir.

## Tareas

1. [ ] Implementar el Custom Access Token Hook que inyecta las membresías en el JWT
2. [ ] Ajustar `RolesGuard` para leer el rol del token y solo ir a la base de datos en acciones sensibles
3. [ ] Documentar en el README qué acciones se consideran sensibles y por qué
4. [ ] Definir el tiempo de expiración del access token
