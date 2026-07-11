# ASOVICAM — Sitio web

Sitio institucional de **ASOVICAM** (Asociación Campesina Vida en el Campo)
construido con React 19 + TypeScript + Vite.

## Visor 3D de productos agrícolas

La ruta **`/productos`** muestra un visor 3D interactivo (maíz, frijol, sandía)
construido con `three`, `@react-three/fiber`, `@react-three/drei` y
`@react-three/postprocessing`, con UI en TailwindCSS.

### Instalación

```bash
npm install
npm run dev
```

Visita <http://localhost:5173/productos>.

### Arquitectura del visor

Los modelos 3D son **100% procedurales**: se construyen en el cliente con
primitivas de Three.js (cilindro, esfera, tubo) y se decoran con texturas
generadas en `<canvas>` 2D (color + bump). No hay archivos `.glb`, no se
descargan assets externos pesados y no se inyectan shaders custom — todo
es código JavaScript determinista, fácil de mantener.

### Editar textos del visor

Toda la copia (nombres, descripciones, ciclo de cultivo, región, etc.)
vive en un solo archivo:

```
src/components/ProductViewer/products.js
```

### Estructura del módulo

```
src/components/ProductViewer/
├── index.jsx           # Componente principal exportable
├── Scene.jsx           # Canvas, luces, sombras y post-processing
├── Model.jsx           # Dispatcher por id de producto
├── models/
│   ├── CornModel.jsx
│   ├── BeanModel.jsx
│   └── WatermelonModel.jsx
├── textures.js         # Generadores de texturas en canvas 2D
├── ProductSelector.jsx # Tarjetas de selección
├── InfoPanel.jsx       # Panel lateral con datos
├── Loader.jsx          # Overlay de carga
└── products.js         # Datos editables (textos)
```

### Despliegue en Vercel

El proyecto ya es compatible con Vercel sin configuración extra:

1. Conecta el repositorio en <https://vercel.com/new>.
2. Framework preset: **Vite** (auto-detectado).
3. Build command: `npm run build` (default).
4. Output directory: `dist` (default).

> El HDRI ambiental usa el preset `apartment` que `@react-three/drei`
> sirve desde su CDN. No requiere configuración manual.

## Backend y acceso de administradores

El backend (Express + MongoDB, repo `fonck95/asovicam-backend`) vive en
**`https://api.asovicam.org`** y ya incluye un dashboard de administración
completo en `https://api.asovicam.org/admin` con login por Google.

- La URL del backend se configura con la variable **`VITE_API_BASE_URL`**
  (ver `.env`; en Vercel debe valer `https://api.asovicam.org`, sin `www.`
  y sin barra final, y todo cambio requiere redeploy porque las variables
  `VITE_*` se inyectan en build time).
- El enlace **«Acceso administradores»** del footer y la ruta local
  **`/admin`** navegan (página completa, nunca `fetch`) al dashboard del
  backend, que muestra su propia pantalla de login. Las rutas `/auth/*` y
  `/api/admin/*` del backend no tienen CORS a propósito: desde este origen
  solo funcionan por navegación.

## Sorteo de lotes (`/admin/sorteo`)

El sorteo es una **herramienta de administración**: no aparece en la
navegación del sitio y la ruta pública `/sorteo` solo sirve para **seguir
en vivo** un sorteo recibido por enlace (sin enlace muestra un aviso de
acceso restringido). La organización se hace desde **`/admin/sorteo`**
(URL sin enlaces públicos; al copiar el enlace del sorteo se comparte
siempre la URL pública `/sorteo#…`).

> Nota: el sorteo corre 100 % en el cliente y el frontend no puede validar
> la sesión del dashboard (cookie de `api.asovicam.org`, sin CORS), así que
> `/admin/sorteo` está oculta pero no autenticada. Autenticarla de verdad
> requeriría cambios en el backend.

Cómo funciona el sorteo entre personas o agrupaciones:

1. **Mapa**: por defecto usa los 48 lotes del predio LA FARAONA, pero se
   puede cargar cualquier archivo **KML o KMZ** (exportado de Google My
   Maps, Google Earth, QGIS…). Cada polígono del archivo se toma como un
   lote; el polígono que envuelve a los demás se usa como lindero. Si el
   nombre/descripción de un lote declara su área («Parcela 3 — 11.76 ha»),
   esa cifra manda; si no, se calcula con la geometría.
2. **Participantes**: el organizador pega (o sube en .csv/.txt) la lista —
   debe coincidir con la cantidad de lotes, o marcar la opción de lotes
   libres si son menos.
3. Al iniciar se genera un **enlace compartible**: la lista, la semilla
   aleatoria, la hora de inicio y el mapa cargado (comprimido) viajan en
   el hash de la URL.
4. Cada persona que abra el enlace ve el mismo sorteo revelarse **en
   tiempo real y sincronizado** en su propio dispositivo (sin backend:
   el resultado se calcula de forma determinista con la semilla pública
   y se revela según el reloj).
5. Al finalizar se puede descargar el acta en CSV.

Los polígonos del mapa predeterminado provienen del Google My Maps
oficial. Si ese mapa cambia, regenera los datos con:

```bash
node scripts/sync-parcelas.mjs   # descarga el KML y reescribe src/data/parcelas.ts
```

## Scripts

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción (tsc + vite build)
npm run preview    # Preview del build
npm run lint       # ESLint
```
