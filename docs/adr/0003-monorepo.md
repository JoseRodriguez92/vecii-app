# ADR-0003: Monorepo pnpm con `apps/` y `packages/`

**Estado:** Aceptada
**Fecha:** 2026-09-06
**Deciders:** Web Team

## Contexto

El repositorio tenía tres proyectos —`BE/`, `FE/`, `Landing/`— cada uno con su propio lockfile
y sin nada en la raíz que los uniera. Eso no es un monorepo: son tres proyectos que comparten
carpeta.

Con la landing en Next.js y la app en Expo, hay código que inevitablemente se repite: los tipos
de la API, los colores y tipografías de la marca, el cliente HTTP con el JWT.

## Decisión

Un workspace pnpm en la raíz:

```
vecii/
├── pnpm-workspace.yaml
├── package.json
├── apps/
│   ├── api/                NestJS        (antes BE/)
│   ├── landing/            Next.js       (antes Landing/)
│   └── vecii/              Expo          (antes FE/)
├── packages/
│   ├── contracts/          tipos y enums de la API   → api + web + native
│   ├── tokens/             colores, tipografía, spacing → web + native
│   ├── auth/               cliente Supabase + SessionProvider → solo native
│   └── ui-native/          componentes React Native → solo native
└── docs/adr/
```

Las carpetas se mueven con `git mv` para conservar el historial.

## Opciones consideradas

### A. Monorepo con workspace pnpm — *elegida*

**A favor:** un solo `pnpm install`; los tipos de la API se comparten en vez de copiarse; un
cambio que toca API y app va en un solo PR.
**En contra:** Expo en monorepo requiere configuración explícita de rutas.

### B. Seguir con proyectos independientes

**A favor:** cero configuración; cada proyecto se despliega solo.
**En contra:** el tipo `Conjunto` terminaría escrito a mano en cuatro lugares —hoy ya está
duplicado entre Prisma y la pantalla de inicio de la app—. Esa desincronización es la fuente
número uno de bugs en este tipo de proyecto.

### C. Repositorios separados

Descartada. Un equipo pequeño coordinando cambios entre tres repos gasta más en coordinación que
lo que ahorra en aislamiento.

## Análisis de trade-offs

El costo real de A es la fricción de Expo en monorepos: Metro necesita `watchFolders` y
`nodeModulesPaths` explícitos, y en compilaciones nativas hay que fijar el project root en
Gradle y en el Podfile. Está documentado y es superable, pero hay que presupuestar el rato.

Se hace **ahora** precisamente porque el repositorio está vacío. Con tres apps ya escritas, la
misma migración es diez veces más cara.

Dos aclaraciones sobre `packages/`:

- **`ui-native` no se comparte con la landing.** Next.js renderiza React DOM y Expo renderiza
  React Native; un componente de uno no funciona en el otro. Lo que sí cruza son los **tokens**
  —colores, tipografía, espaciado— en TypeScript plano.
- **`contracts` se genera desde el OpenAPI** que la API ya expone en `/docs`, en vez de
  mantenerse a mano.

## Consecuencias

**Más fácil:** un cambio de API y su consumo viajan juntos; los tipos dejan de duplicarse; la
marca es consistente porque sale de un solo lugar.

**Más difícil:** configurar Metro; y sin herramienta de build con grafo de dependencias, un
cambio en `packages/tokens` obliga a reconstruir todo o a acordarse de reconstruir lo correcto.

**A revisar si:** hay dos o más apps activas y los tiempos de build molestan → evaluar Turborepo.
Hoy no compensa la complejidad.

## Tareas

1. [ ] Crear `pnpm-workspace.yaml` y `package.json` en la raíz
2. [ ] `git mv BE apps/api`, `git mv Landing apps/landing`, `git mv FE apps/vecii`
3. [ ] Eliminar los `pnpm-workspace.yaml` internos de `apps/api` y `apps/landing`
4. [ ] Configurar `metro.config.js` con `watchFolders` y `nodeModulesPaths`
5. [ ] Crear `packages/contracts` generando los tipos desde el OpenAPI de la API
6. [ ] Mover el tipo `Conjunto` escrito a mano en la app para que venga de `contracts`
7. [ ] Actualizar el README raíz con la nueva estructura
