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

## Scripts

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción (tsc + vite build)
npm run preview    # Preview del build
npm run lint       # ESLint
```
