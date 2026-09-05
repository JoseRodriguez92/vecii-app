# Vecii · Frontend

App multiplataforma (Web · Android · iOS) para la gestión de conjuntos residenciales.

**Stack:** Expo SDK 57 · React Native 0.86 · Expo Router (rutas tipadas) · Supabase Auth.

## Requisitos

- Node 22+
- pnpm 11+
- App **Expo Go** (para probar en dispositivo) o un emulador Android / simulador iOS

## Puesta en marcha

```bash
pnpm install
cp .env.example .env         # completa EXPO_PUBLIC_SUPABASE_* y EXPO_PUBLIC_API_URL
pnpm start                   # luego: w (web) · a (Android) · i (iOS)
```

> Levanta primero el backend (`../BE`). En emulador Android usa `http://10.0.2.2:3000/api`;
> en dispositivo físico, la IP LAN de tu PC.

## Variables de entorno

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |
| `EXPO_PUBLIC_API_URL` | URL base de la API de NestJS (incluye `/api`) |

## Cómo funciona

- **`src/lib/supabase.ts`** — cliente de Supabase con persistencia en `AsyncStorage` y auto-refresh del token.
- **`src/context/session.tsx`** — `SessionProvider` + `useSession()`: expone `session`, `signInWithPassword`, `signUpWithPassword`, `signOut`.
- **`src/lib/api.ts`** — `api(path, opts)`: hace `fetch` a NestJS adjuntando `Authorization: Bearer <token>` y, si pasas `conjuntoId`, la cabecera `x-conjunto-id`.
- **`src/app/_layout.tsx`** — navegación raíz. `Stack.Protected` muestra `(app)` si hay sesión y `sign-in` si no.

## Estructura de rutas

```
src/app/
  _layout.tsx        Raíz: SessionProvider + Stack protegido
  sign-in.tsx        Login / registro (email + contraseña)
  (app)/             Área autenticada
    _layout.tsx      Tabs
    index.tsx        "Mis conjuntos" (consume la API)
    explore.tsx
```

## Builds nativos

Para Android/iOS de producción se usa **EAS Build** (build en la nube, no requiere Mac para empezar):

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli build:configure
pnpm dlx eas-cli build --platform android --profile preview
```

## Notas

- Proyecto configurado para **pnpm** con `node-linker=hoisted` (`.npmrc`) — necesario para Metro.
- Rutas tipadas y React Compiler están activados en `app.json` (`experiments`).
