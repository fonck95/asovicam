# Modelos 3D — `/public/models/`

> El visor 3D del sitio actualmente **no consume archivos `.glb`**.
> Los modelos (maíz, frijol, sandía) se construyen 100% en el cliente
> con primitivas Three.js + texturas procedurales generadas en
> `<canvas>` 2D. Esto evita assets pesados, descargas externas y
> problemas de compatibilidad de shaders.

## Editar los modelos procedurales

Cada modelo vive en su propio archivo:

- `src/components/ProductViewer/models/CornModel.jsx`
- `src/components/ProductViewer/models/BeanModel.jsx`
- `src/components/ProductViewer/models/WatermelonModel.jsx`

Las texturas (color y bump) se generan en:

- `src/components/ProductViewer/textures.js`

Podés ajustar colores, número de granos, curvatura de la vaina o
el patrón de franjas sin tocar el resto del visor.

## Editar los textos

Toda la copia (nombres, descripciones, ciclo de cultivo, región, etc.)
vive en un solo archivo:

```
src/components/ProductViewer/products.js
```
