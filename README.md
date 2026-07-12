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

## Backend y panel de administración

El backend (Express + MongoDB, repo `fonck95/asovicam-backend`) vive en
**`https://api.asovicam.org`**. El panel de administración se sirve desde
**`https://asovicam.org/admin`** y usa el login por Google del backend.

- La URL del backend se configura con la variable **`VITE_API_URL`**
  (ver `.env`; en Vercel debe valer `https://api.asovicam.org`, sin `www.`
  y sin barra final, y todo cambio requiere redeploy porque las variables
  `VITE_*` se inyectan en build time).
- `/admin` lleva `noindex` y se enlaza discretamente desde el pie de página
  del sitio («Acceso administradores»). El panel llama al backend con cookies
  (`credentials: 'include'`); el botón «Entrar con Google» es la única
  navegación de página completa, hacia `/auth/google`.

### Contenido del sitio desde la API pública

Al cargar, la SPA pide **`GET /api/public/content`** (CORS habilitado para
`https://www.asovicam.org`, sin credenciales) y con la respuesta pinta
programas, estadísticas, equipo, testimonios, FAQs, cultivos, slides de
portada, galería y los ajustes de contacto/redes/hero editados en el
dashboard.

- **Fallback silencioso**: si la petición falla (red, previews `*.vercel.app`
  sin CORS, 5xx, timeout de 8 s) o una colección llega vacía porque aún no
  hay elementos publicados, se usa el contenido estático de `src/data/*.ts`
  — el sitio nunca se ve roto. La última respuesta buena se cachea en
  `localStorage` para el primer render de visitas repetidas.
- **Formulario de contacto**: envía a **`POST /api/public/contact`** y los
  mensajes llegan al dashboard (`/admin` → Mensajes). Maneja los errores de
  validación por campo (400), el rate limit de 5 envíos / 15 min (429) y las
  caídas de red con mensajes en pantalla; solo si el build no tiene
  `VITE_API_BASE_URL` cae al viejo `mailto:`.
- Todo el contenido del CMS se renderiza como **texto plano** (nunca HTML) y
  el frontend no guarda nada de autenticación: la sesión vive en la cookie
  httpOnly de `api.asovicam.org`.

## Sorteo de lotes (`/admin/sorteo`)

El sorteo es una **herramienta de administración**: no aparece en la
navegación del sitio y la ruta pública `/sorteo` solo sirve para **seguir
en vivo** un sorteo recibido por enlace (sin enlace muestra un aviso de
acceso restringido). La organización se hace desde **`/admin/sorteo`**
(URL sin enlaces públicos; al copiar el enlace del sorteo se comparte
siempre la URL pública `/sorteo#…`).

> El sorteo sigue corriendo 100 % en el cliente, pero `/admin/sorteo` ahora
> está bajo el mismo guard de sesión del panel.

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
