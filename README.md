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

> El visor funciona desde el primer arranque incluso sin modelos `.glb`:
> usa geometrías primitivas como fallback hasta que coloques los archivos.

### Cómo agregar los modelos `.glb` reales

1. Coloca los archivos en `public/models/` con estos nombres exactos:
   - `corn.glb` — Maíz
   - `bean.glb` — Frijol
   - `watermelon.glb` — Sandía
2. El visor detecta automáticamente que existen (vía `HEAD` request) y
   deja de usar los fallbacks primitivos.

### Dónde descargar modelos gratis

- **[Sketchfab](https://sketchfab.com/3d-models)** filtrando por
  `Downloadable` + licencia `Creative Commons - Attribution`.
  Búsquedas sugeridas: `corn cob low poly`, `bean plant`,
  `watermelon realistic`.
- **[Poly Haven](https://polyhaven.com/models)** — modelos CC0.
- **[Quaternius](https://quaternius.com/)** — packs CC0.

### Optimización

Comprime los `.glb` antes de subirlos (Draco / Meshopt):

- **Web (sin instalar nada):** <https://gltf.report/>
- **CLI:**
  ```bash
  npm install -g @gltf-transform/cli
  gltf-transform optimize raw.glb corn.glb --compress draco
  ```

Más detalles en [`public/models/README.md`](./public/models/README.md).

### Editar textos del visor

Toda la copia (nombres, descripciones, ciclo de cultivo, región, etc.)
vive en un solo archivo:

```
src/components/ProductViewer/products.js
```

Cambia ahí los strings y los `modelPath` si renombras los `.glb`.

### Estructura del módulo

```
src/components/ProductViewer/
├── index.jsx           # Componente principal exportable
├── Scene.jsx           # Canvas, luces, postprocessing y zoom limitado
├── Model.jsx           # Carga del .glb + fallbacks primitivos
├── ProductSelector.jsx # Tarjetas de selección
├── InfoPanel.jsx       # Panel lateral con datos
├── Loader.jsx          # Overlay de carga con barra de progreso
└── products.js         # Datos editables (textos, paths)
```

### Despliegue en Vercel

El proyecto ya es compatible con Vercel sin configuración extra:

1. Conecta el repositorio en <https://vercel.com/new>.
2. Framework preset: **Vite** (auto-detectado).
3. Build command: `npm run build` (default).
4. Output directory: `dist` (default).
5. Asegúrate de que `public/models/*.glb` esté commiteado en el repo
   — Vercel lo servirá como assets estáticos en `https://tu-dominio.com/models/...`.

> El HDRI se descarga en runtime desde Poly Haven CDN. Si prefieres
> servirlo localmente, descarga `studio_small_09_1k.hdr` a
> `public/hdr/` y cambia la URL en `src/components/ProductViewer/Scene.jsx`.

## Scripts

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción (tsc + vite build)
npm run preview    # Preview del build
npm run lint       # ESLint
```
