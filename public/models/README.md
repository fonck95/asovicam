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

---

# Experiencia inmersiva — ruta `/experiencia`

La ruta `/experiencia` es una **one-page scroll experience** estilo
página de producto (OPPO): el modelo persiste en pantalla mientras la
cámara, la luz y el texto cambian a medida que haces scroll. El loop está
unificado en un único `requestAnimationFrame` (Lenis + `gsap.ticker` +
el `renderer` de Three.js) para una sensación "seamless" sin micro-tirones.

Todo el código vive en `src/components/Experience/` y **un único bloque
`CONFIG`** (`config.js`) concentra los parámetros editables.

## Usar TU propio modelo `.glb` en la experiencia

Por defecto, la experiencia usa el modelo **procedural** indicado por
`CONFIG.MODEL_ID` (`'maiz' | 'frijol' | 'sandia'`). Para usar un `.glb`:

1. Copia tu archivo a esta carpeta, p.ej. `public/models/mi-modelo.glb`.
2. En `src/components/Experience/config.js`:

   ```js
   MODEL_URL: '/models/mi-modelo.glb', // antes: null
   ```

3. (Opcional) Si tu `.glb` está comprimido con **DRACO**, ya está listo:
   se usa el decoder de `CONFIG.DRACO_PATH` (CDN de Google por defecto).
   Para servirlo local, copia los decoders a `public/draco/` y pon
   `DRACO_PATH: '/draco/'`.
4. Reencuadra la cámara: ajusta los `cam.pos` / `cam.target` de cada
   sección en `src/components/Experience/sections.js` a la escala de tu
   modelo (y si hace falta, `MODEL_BASE_SCALE` / `MODEL_Y_OFFSET`).

## Dónde se conecta el scroll con el 3D

- `sections.js` → keyframes (cámara, rotación, escala, luz, fondo) por sección.
- `useUnifiedScroll.js` → el loop unificado y la timeline scrubbeada.
- `Stage.jsx` → `useFrame` que APLICA esos valores a la escena cada frame.

Cada mapeo scroll → propiedad 3D está comentado en el código.
