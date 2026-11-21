# Green 360° · Dashboard de Operaciones y Gestión Comercial

Aplicación multiplataforma (web, iOS y Android): Clientes 360°, segmentación automática, analítica comercial,
asistente IA, servicios y operaciones, e importación/exportación XLSX/CSV. Modo claro y oscuro.

**Stack:** Expo SDK 58 · React Native 0.88 · TypeScript estricto · Expo Router · NativeWind (Tailwind) ·
Zustand · TanStack Query · React Hook Form + Zod · react-native-gifted-charts · SheetJS · **Firebase (Auth + Cloud Firestore)** · Vitest.

## Ejecutar

```bash
npm install
npm run web        # Expo Web en el navegador (recomendado para la demo)
npm run ios        # o: npm run android  (Expo Go / development build)
```

Sin Firebase configurado, la app usa almacenamiento local y el usuario `operativo1` / `root123`.

| Script | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (segmentación, validación, importación, asistente) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:web` | Exporta la versión web estática a `dist/` |
| `npm run fixtures` | Regenera `src/data/fixtures/*.json` (datos iniciales) desde los CSV de `../Green_Services_Recursos_de_Prueba/01_Datos` |
| `node scripts/theme.mjs` | Regenera la paleta (claro/oscuro) en `global.css` y `src/core/theme/palette.ts` |

## Firebase (base de datos)

1. Crea un proyecto en [Firebase](https://console.firebase.google.com) y agrega una app **Web**.
2. **Authentication → Sign-in method:** habilita *Correo/contraseña* y crea los usuarios (p. ej. `operativo1@tuempresa.com`).
3. **Firestore Database:** créala en modo producción y publica las reglas de `firestore.rules` (solo usuarios autenticados):
   `npx firebase-tools deploy --only firestore:rules --project <id-del-proyecto>`
4. Copia `.env.example` a `.env` y completa `EXPO_PUBLIC_FIREBASE_*` con la configuración de la app web.
   Con `EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN=tuempresa.com` se puede iniciar sesión escribiendo solo `operativo1`.
5. Reinicia `npm run web`. En el primer inicio de sesión se cargan los datos iniciales en Firestore (colecciones
   `customers`, `sales`, `trainings`, `licenses`, `consultations`; reglas en `settings/rules`; marcas en `_meta`).

El `apiKey` de Firebase web es un identificador público; la seguridad la dan Firebase Auth y `firestore.rules`.
Cada carga lee la colección completa de ventas (~1.400 documentos): para volúmenes grandes conviene paginar o agregar en el backend.

## Asistente IA

- `EXPO_PUBLIC_AI_MODE=reglas` (por defecto): insights por reglas de negocio deterministas sobre los datos.
- `EXPO_PUBLIC_AI_MODE=connected` + `EXPO_PUBLIC_AI_API_URL`: la app envía la pregunta y un resumen mínimo (sin contacto, correo ni teléfono) a `POST {URL}/insights/ask` y espera un `InsightAnswer` (`src/modules/ai-insights/domain/insights.ts`). Las claves del proveedor de IA viven en ese backend, **nunca** en la app.

## Arquitectura

```
src/
  app/                     rutas (Expo Router): login, (app)/ protegidas
  core/                    config, tema, utils, almacenamiento, navegación, contenedor de dependencias
  shared/                  componentes (ui, DataTable, charts), hooks, layout (AppShell)
  modules/
    auth/                  domain · application (store de sesión) · infrastructure (Firebase Auth / local)
    customers/             domain (entidades, segmentación, filtros) · application · infrastructure · presentation
    analytics/             domain (KPIs y series) · presentation
    ai-insights/           domain (puerto AIInsightsService) · infrastructure (reglas / http) · presentation (panel)
    imports/               domain (mapeo, validación, duplicados, puertos) · application · infrastructure (SheetJS, archivos web/nativo)
    services/              training · licenses · consultations (domain + presentation) y repositorios
  data/fixtures/           datos del reto + datos demo
```

- Las dependencias apuntan al dominio. Las pantallas usan hooks; los hooks usan servicios de aplicación; los servicios dependen de **interfaces** (`CustomerRepository`, `AuthService`, `AIInsightsService`, `FileGateway`, `SpreadsheetCodec`, `CrudRepository`).
- `src/core/providers/container.ts` es el único lugar que conoce las implementaciones. `src/core/storage/collection.ts` elige Firestore o almacenamiento local según la configuración.
- La lógica de negocio es pura y se prueba sin pantallas (`tests/`).

## Datos iniciales

- Clientes, ventas y TRM diaria (120 clientes, 1.407 ventas). Los montos en USD se convierten a COP con la TRM de la fecha de cada venta.
- Contacto, correo y teléfono vienen vacíos: se completan editando el cliente o importando un archivo.
- Capacitaciones, licencias y bases de consulta traen registros iniciales editables.
- «Configuración → Restablecer datos iniciales» borra todo y vuelve a cargar estos datos.

Más detalle de reglas y supuestos en [DECISIONES.md](DECISIONES.md).
