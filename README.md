# Green 360° · Dashboard de Operaciones y Gestión Comercial

Aplicación multiplataforma (web, iOS y Android): Clientes 360°, segmentación automática, analítica comercial,
asistente IA, servicios y operaciones, e importación/exportación XLSX/CSV. Modo claro y oscuro.

**Stack:** Expo SDK 58 · React Native 0.88 · TypeScript estricto · Expo Router · NativeWind (Tailwind) ·
Zustand · TanStack Query · React Hook Form + Zod · react-native-gifted-charts · SheetJS · AsyncStorage · Vitest.

## Ejecutar

```bash
npm install
npm run web        # Expo Web en el navegador (recomendado para la demo)
npm run ios        # o: npm run android  (Expo Go / development build)
```

Usuario: `operativo1` · contraseña: `root123`.

| Script | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (segmentación, validación, importación, asistente) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:web` | Exporta la versión web estática a `dist/` |
| `npm run fixtures` | Regenera `src/data/fixtures/*.json` (datos iniciales) desde los CSV de `../Green_Services_Recursos_de_Prueba/01_Datos` |
| `node scripts/theme.mjs` | Regenera la paleta (claro/oscuro) en `global.css` y `src/core/theme/palette.ts` |

## Datos y almacenamiento

Los datos se guardan en el almacenamiento local del dispositivo (AsyncStorage; `localStorage` en web): no se comparten entre equipos ni usuarios.
Las pantallas no dependen del almacenamiento: para pasar a una base de datos remota basta con implementar `Collection` en `src/core/storage/collection.ts`.

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
    auth/                  domain · application (store de sesión) · infrastructure (usuario local)
    customers/             domain (entidades, segmentación, filtros) · application · infrastructure · presentation
    analytics/             domain (KPIs y series) · presentation
    ai-insights/           domain (puerto AIInsightsService) · infrastructure (reglas / http) · presentation (panel)
    imports/               domain (mapeo, validación, duplicados, puertos) · application · infrastructure (SheetJS, archivos web/nativo)
    services/              training · licenses · consultations (domain + presentation) y repositorios
  data/fixtures/           datos del reto + datos demo
```

- Las dependencias apuntan al dominio. Las pantallas usan hooks; los hooks usan servicios de aplicación; los servicios dependen de **interfaces** (`CustomerRepository`, `AuthService`, `AIInsightsService`, `FileGateway`, `SpreadsheetCodec`, `CrudRepository`).
- `src/core/providers/container.ts` es el único lugar que conoce las implementaciones. Las colecciones pasan por el puerto `Collection` (`src/core/storage/collection.ts`).
- La lógica de negocio es pura y se prueba sin pantallas (`tests/`).

## Datos iniciales

- Clientes, ventas y TRM diaria (120 clientes, 1.407 ventas). Los montos en USD se convierten a COP con la TRM de la fecha de cada venta.
- Contacto, correo y teléfono vienen vacíos: se completan editando el cliente o importando un archivo.
- Capacitaciones, licencias y bases de consulta traen registros iniciales editables.
- «Configuración → Restablecer datos iniciales» borra todo y vuelve a cargar estos datos.

Más detalle de reglas y supuestos en [DECISIONES.md](DECISIONES.md).
