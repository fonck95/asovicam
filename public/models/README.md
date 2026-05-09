# Modelos 3D — `/public/models/`

El visor 3D usa por defecto **modelos procedurales detallados**
construidos con Three.js (mazorca con cientos de kernels reales,
vaina con frijoles visibles, sandía con shader de franjas). Estos
modelos viven en `src/components/ProductViewer/models/` y no
requieren ninguna descarga: el sitio funciona desde el primer
`npm run dev`.

Si querés sustituirlos por modelos `.glb` reales (por ejemplo
escaneos fotogramétricos), colocá los archivos aquí con los
nombres esperados y el visor los detecta automáticamente.

## Archivos opcionales

| Archivo            | Producto |
| ------------------ | -------- |
| `corn.glb`         | Maíz     |
| `bean.glb`         | Frijol   |
| `watermelon.glb`   | Sandía   |

## Activar los `.glb`

Para evitar 404s en consola cuando los archivos no existen, el visor
no hace probes a `/models/*.glb`: en su lugar lee la lista de modelos
disponibles desde `manifest.json` (en este mismo directorio).

Cuando coloques un `.glb` real, agregá su nombre al manifest:

```json
["corn.glb", "bean.glb", "watermelon.glb"]
```

Los productos cuyo archivo aparezca en el manifest cargan el `.glb`;
el resto sigue usando el modelo procedural HD.

## Dónde descargar modelos gratuitos verificados

1. **[Poly Pizza](https://poly.pizza/)** — sucesor comunitario de
   Google Poly. Filtros por licencia CC0 / CC-BY. Búsquedas:
   - `corn` / `corn cob`
   - `bean plant` / `bean pod`
   - `watermelon`

   Hay un modelo "Watermelon Character" CC0 de Polygonal Mind
   directamente descargable como GLB.

2. **[Quaternius — Ultimate Stylized Nature Pack](https://quaternius.com/packs/ultimatestylizednature.html)**
   — pack CC0 de plantas estilizadas (descarga ZIP, conviértelo a GLB con `gltf-transform`).

3. **[Kenney Assets — Nature Kit](https://kenney.nl/assets/nature-kit)**
   — assets CC0 low-poly.

4. **[Sketchfab](https://sketchfab.com/3d-models?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b)**
   — modelos descargables con licencia CC-BY (recordá dar crédito en el footer).

5. **[Poly Haven — Models](https://polyhaven.com/models)** — CC0 (sin atribución requerida).

## Optimización de los `.glb` (recomendado)

Los `.glb` directos suelen pesar bastante. Antes de usarlos en producción,
comprimilos con Draco/Meshopt:

### Opción A — gltf.report (web, sin instalar nada)

1. Abrí <https://gltf.report/>
2. Subí tu `.glb`.
3. Activá `Draco compression` y `Meshopt`.
4. Descargá el resultado y renombralo a `corn.glb`, `bean.glb` o `watermelon.glb`.

### Opción B — gltf-transform (CLI)

```bash
npm install -g @gltf-transform/cli
gltf-transform optimize input.glb corn.glb --compress draco
```

## Cambiar nombres de archivo

Si querés usar otros nombres, edítalos en
`src/components/ProductViewer/products.js`, campo `modelPath`.

## Editar los modelos procedurales

Cada modelo procedural vive en su propio archivo:

- `src/components/ProductViewer/models/CornModel.jsx`
- `src/components/ProductViewer/models/BeanModel.jsx`
- `src/components/ProductViewer/models/WatermelonModel.jsx`

Podés ajustar colores, número de kernels, curvatura de la vaina o
parámetros del shader de la sandía sin tocar el resto del visor.
