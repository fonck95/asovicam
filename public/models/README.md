# Modelos 3D — `/public/models/`

Esta carpeta debe contener los archivos `.glb` que el visor 3D consume.

## Archivos esperados

| Archivo            | Producto |
| ------------------ | -------- |
| `corn.glb`         | Maíz     |
| `bean.glb`         | Frijol   |
| `watermelon.glb`   | Sandía   |

> Mientras los archivos no existan (o pesen muy poco), el visor mostrará
> automáticamente **geometrías primitivas** como fallback (un cilindro
> amarillo para el maíz, una esfera achatada verde para la sandía y una
> cápsula con semillas para el frijol). Esto permite que el proyecto
> funcione desde el primer `npm run dev` sin descargar nada.

## Dónde descargar modelos gratuitos

1. **[Sketchfab](https://sketchfab.com/3d-models)**
   - Filtra por `Downloadable` + licencia `Creative Commons - Attribution`.
   - Búsquedas sugeridas:
     - `corn cob low poly`
     - `bean plant`
     - `watermelon realistic`
   - Descarga el `.glb` (no `.gltf` separado).
   - **Recuerda dar crédito** al autor en el footer del sitio.

2. **[Poly Haven](https://polyhaven.com/models)** — modelos CC0 (sin atribución).

3. **[Quaternius](https://quaternius.com/)** — packs CC0 de plantas y frutas.

## Optimización (recomendado)

Los `.glb` directos suelen ser pesados. Para web, comprime con Draco/Meshopt:

### Opción A — gltf.report (web, sin instalar nada)

1. Abre <https://gltf.report/>
2. Sube tu `.glb`.
3. Activa `Draco compression` y `Meshopt`.
4. Descarga el resultado y renombra a `corn.glb`, `bean.glb` o `watermelon.glb`.

### Opción B — gltf-transform (CLI)

```bash
npm install -g @gltf-transform/cli
gltf-transform optimize input.glb corn.glb --compress draco
```

## Cómo cambiar a otros modelos

Si quieres usar otros nombres de archivo, edítalos en
`src/components/ProductViewer/products.js`, campo `modelPath`.
