import * as THREE from 'three';

// =====================================================
// Texturas procedurales generadas en <canvas> 2D.
//
// Cada superficie obtiene hasta 3 mapas:
//   - color  (sRGB, base albedo)
//   - normal (linear, calculado vía Sobel desde un height map)
//   - rough  (linear, controla brillo localmente)
//
// Para texturas internas de fruta usamos además ruido FBM
// (value noise apilado en octavas) con gradientes radiales y
// detalle granular fino — el secreto del look fotográfico.
// =====================================================

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toColorTexture(canvas, { repeat = [1, 1], anisotropy = 16 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function toLinearTexture(canvas, { repeat = [1, 1], anisotropy = 16 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Noise: hash + value-noise + FBM ----------

function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function valueNoise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);

  const ux = xf * xf * (3 - 2 * xf);
  const uy = yf * yf * (3 - 2 * yf);

  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}

function fbm2D(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let amp = 1.0;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

// Voronoi/cellular basado en hash — ideal para celdas de pulpa, vetas
function cellular2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let minDist = 9.0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const px = cx + hash2(cx, cy);
      const py = cy + hash2(cx + 13, cy + 7);
      const dx = px - x;
      const dy = py - y;
      const d = dx * dx + dy * dy;
      if (d < minDist) minDist = d;
    }
  }
  return Math.sqrt(minDist);
}

// ---------- Sobel: height → normal ----------

function heightToNormalCanvas(heightCanvas, strength = 1.0) {
  const W = heightCanvas.width;
  const H = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d', { willReadFrequently: true });
  const src = srcCtx.getImageData(0, 0, W, H).data;

  const out = makeCanvas(W, H);
  const dstCtx = out.getContext('2d');
  const dst = dstCtx.createImageData(W, H);

  const get = (x, y) => {
    const xx = ((x % W) + W) % W;
    const yy = ((y % H) + H) % H;
    return src[(yy * W + xx) * 4] / 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tl = get(x - 1, y - 1);
      const t  = get(x,     y - 1);
      const tr = get(x + 1, y - 1);
      const l  = get(x - 1, y);
      const r  = get(x + 1, y);
      const bl = get(x - 1, y + 1);
      const b  = get(x,     y + 1);
      const br = get(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv; ny *= inv; nz *= inv;

      const i = (y * W + x) * 4;
      dst.data[i + 0] = (nx * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      dst.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }

  dstCtx.putImageData(dst, 0, 0);
  return out;
}

function normalTextureFromHeightCanvas(canvas, strength = 1.0, repeat = [1, 1]) {
  const normalCanvas = heightToNormalCanvas(canvas, strength);
  return toLinearTexture(normalCanvas, { repeat });
}

// ---------- Helpers de color ----------

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function rgbStr(rgb, alpha = 1) {
  return `rgba(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0},${alpha})`;
}

// Pintar mapa de altura "celular" (puntos brillantes/oscuros aleatorios con FBM)
function paintFbmHeight(ctx, W, H, { scale = 4, octaves = 5, contrast = 1, base = 0.5 } = {}) {
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = fbm2D((x / W) * scale, (y / H) * scale, octaves);
      n = (n - 0.5) * contrast + base;
      n = Math.max(0, Math.min(1, n));
      const v = (n * 255) | 0;
      const i = (y * W + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// =====================================================
// MAÍZ
// =====================================================

function paintCornKernels(ctx, W, H) {
  // Fondo cálido — el espacio entre granos se ve apenas
  ctx.fillStyle = '#5a3a0a';
  ctx.fillRect(0, 0, W, H);

  const COLS = 22;
  const ROWS = 28;
  const cellW = W / COLS;
  const cellH = H / ROWS;

  // Paleta diversa: la mazorca tiene granos amarillos, ámbar, dorados,
  // algunos más pálidos en la base (los más jóvenes), algunos más cálidos.
  const palette = [
    '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
    '#fde047', '#facc15', '#eab308', '#fef3c7',
    '#fdba74', '#fdbb2d',
  ];

  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    // Granos de la base más pálidos (lácteo); los del medio dorados.
    const rowDepth = Math.abs(row / ROWS - 0.5) * 2; // 0 centro → 1 extremos
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;

      // Variación natural por grano
      const seedHash = hash2(col * 13 + 1.7, row * 7 + 2.3);
      const seed = ((Math.floor(seedHash * palette.length)) + palette.length) % palette.length;
      const baseColor = palette[seed];
      const baseRgb = hexToRgb(baseColor);

      // Granos cerca del extremo más pálidos
      const tipMixed = lerpRgb(baseRgb, [255, 248, 220], rowDepth * 0.45);

      // Forma del grano: ligeramente más alto que ancho, con punta inferior (germ)
      const rx = cellW * (0.46 + (seedHash - 0.5) * 0.04);
      const ry = cellH * (0.50 + (seedHash - 0.5) * 0.05);

      // Sombras de los lados (cada grano tiene relieve)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();

      // Base con gradiente tridimensional: highlight superior-izquierdo
      // → color medio → sombra inferior-derecha → "germ" oscuro abajo
      const hlx = cx - cellW * 0.20;
      const hly = cy - cellH * 0.26;
      const grad = ctx.createRadialGradient(hlx, hly, 0, cx, cy, cellW * 0.6);
      grad.addColorStop(0, '#fffdf2');
      grad.addColorStop(0.18, rgbStr(lerpRgb(tipMixed, [255, 253, 240], 0.4), 1));
      grad.addColorStop(0.55, rgbStr(tipMixed, 1));
      grad.addColorStop(0.85, rgbStr(lerpRgb(tipMixed, [120, 60, 12], 0.55), 1));
      grad.addColorStop(1, '#3b1d04');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

      // Vetas/estrías muy finas en cada grano (FBM modulada)
      const veinCount = 6;
      ctx.globalAlpha = 0.18;
      for (let v = 0; v < veinCount; v++) {
        const vt = v / veinCount;
        const vy = cy - ry + ry * 2 * vt;
        ctx.strokeStyle = `rgba(120, 65, 15, ${0.18 + Math.random() * 0.18})`;
        ctx.lineWidth = 0.35 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx - rx, vy);
        ctx.bezierCurveTo(
          cx - rx * 0.4, vy + (Math.random() - 0.5) * ry * 0.2,
          cx + rx * 0.4, vy + (Math.random() - 0.5) * ry * 0.2,
          cx + rx, vy,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // "Germ" (la marca curva oscura en la base de cada grano)
      ctx.fillStyle = 'rgba(70, 30, 5, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.55, rx * 0.34, ry * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pequeño triángulo claro encima del germ
      ctx.fillStyle = 'rgba(255, 230, 180, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.32, rx * 0.5, ry * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pequeño "agüita" highlight especular fresco
      const wet = ctx.createRadialGradient(
        cx - cellW * 0.18,
        cy - cellH * 0.28,
        0,
        cx - cellW * 0.18,
        cy - cellH * 0.28,
        cellW * 0.25,
      );
      wet.addColorStop(0, 'rgba(255, 253, 240, 0.85)');
      wet.addColorStop(0.4, 'rgba(255, 253, 240, 0.18)');
      wet.addColorStop(1, 'rgba(255, 253, 240, 0)');
      ctx.fillStyle = wet;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

      ctx.restore();

      // Borde exterior — surco oscuro de separación
      ctx.strokeStyle = 'rgba(50, 22, 4, 0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function makeCornColorTexture() {
  const W = 1536, H = 1536;
  const canvas = makeCanvas(W, H);
  paintCornKernels(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintCornHeight(ctx, W, H) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const COLS = 22, ROWS = 28;
  const cellW = W / COLS, cellH = H / ROWS;

  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      // Grano abultado: más alto en el centro-superior
      const grad = ctx.createRadialGradient(cx, cy - cellH * 0.18, 0, cx, cy, cellW * 0.55);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#c8c8c8');
      grad.addColorStop(0.85, '#404040');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Marca de germ (hundimiento)
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + cellH * 0.32, cellW * 0.22, cellH * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function makeCornNormalTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  paintCornHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 3.0);
}

export function makeCornRoughnessTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cfcfcf';
  ctx.fillRect(0, 0, W, H);
  const COLS = 22, ROWS = 28;
  const cellW = W / COLS, cellH = H / ROWS;
  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      // Granos brillantes (rough bajo) sobre surcos mate (rough alto).
      const grad = ctx.createRadialGradient(cx - cellW * 0.18, cy - cellH * 0.22, 0, cx, cy, cellW * 0.55);
      grad.addColorStop(0, '#0c0c0c');     // gota muy reflectiva
      grad.addColorStop(0.3, '#3a3a3a');
      grad.addColorStop(0.65, '#7a7a7a');
      grad.addColorStop(1, '#cdcdcd');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Germ es más opaco (rough alto)
      ctx.fillStyle = 'rgba(220,220,220,0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + cellH * 0.32, cellW * 0.22, cellH * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toLinearTexture(canvas);
}

// =====================================================
// SANDÍA — exterior (cáscara)
// =====================================================

function paintWatermelonRind(ctx, W, H) {
  // Base con gradiente bandeado
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#3f6212');
  base.addColorStop(0.5, '#65a30d');
  base.addColorStop(1, '#365314');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Capa de moteado fino tipo "skin"
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 3 + Math.random() * 22;
    const grn = 100 + Math.random() * 130;
    ctx.fillStyle = `rgba(${grn * 0.7 | 0}, ${grn | 0}, ${grn * 0.4 | 0}, ${0.04 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Franjas oscuras onduladas (con gradiente para volumen)
  const STRIPES = 11;
  const stripeWidth = W / STRIPES;
  for (let s = 0; s < STRIPES; s++) {
    const cx = s * stripeWidth + stripeWidth / 2;
    ctx.save();
    ctx.beginPath();
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * H;
      const wob =
        Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.20 +
        Math.sin(t * 21 + s) * stripeWidth * 0.06 +
        Math.sin(t * 41 + s * 2.1) * stripeWidth * 0.03;
      const x = cx + wob - stripeWidth * 0.32;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * H;
      const wob =
        Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.20 +
        Math.sin(t * 21 + s) * stripeWidth * 0.06 +
        Math.sin(t * 41 + s * 2.1) * stripeWidth * 0.03;
      const x = cx + wob + stripeWidth * 0.32;
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx - stripeWidth * 0.4, 0, cx + stripeWidth * 0.4, 0);
    grad.addColorStop(0, '#03150a');
    grad.addColorStop(0.5, '#0d2a14');
    grad.addColorStop(1, '#03150a');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.clip();
    // Detalles dentro de la franja oscura
    for (let i = 0; i < 160; i++) {
      const x = cx - stripeWidth * 0.5 + Math.random() * stripeWidth;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(70, 110, 40, ${0.06 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Filamentos finos (vetas de cera)
    for (let i = 0; i < 20; i++) {
      const yy = Math.random() * H;
      ctx.strokeStyle = `rgba(20, 40, 12, ${0.18 + Math.random() * 0.18})`;
      ctx.lineWidth = 0.3 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - stripeWidth * 0.5, yy);
      ctx.bezierCurveTo(
        cx - stripeWidth * 0.2, yy + (Math.random() - 0.5) * 30,
        cx + stripeWidth * 0.2, yy + (Math.random() - 0.5) * 30,
        cx + stripeWidth * 0.5, yy,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // Sutil cera ceramica (highlights difusos a baja alpha)
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 40 + Math.random() * 100;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(220, 240, 180, 0.06)');
    grad.addColorStop(1, 'rgba(220, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pequeñas imperfecciones — manchitas oscuras (cicatrices)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(20, 30, 8, ${0.18 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeWatermelonColorTexture() {
  const W = 2048, H = 1024;
  const canvas = makeCanvas(W, H);
  paintWatermelonRind(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintWatermelonHeight(ctx, W, H) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);

  // Franjas levemente elevadas
  const STRIPES = 11;
  const stripeWidth = W / STRIPES;
  for (let s = 0; s < STRIPES; s++) {
    const cx = s * stripeWidth + stripeWidth / 2;
    ctx.save();
    ctx.beginPath();
    const segments = 60;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * H;
      const wob = Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.20;
      const x = cx + wob - stripeWidth * 0.32;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * H;
      const wob = Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.20;
      const x = cx + wob + stripeWidth * 0.32;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#bababa';
    ctx.fill();
    ctx.restore();
  }

  // Ruido pebbly fino + pequeños hoyitos (poros)
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 0.6 + Math.random() * 2.4;
    const v = 80 + Math.random() * 150;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeWatermelonNormalTexture() {
  const W = 1024, H = 512;
  const canvas = makeCanvas(W, H);
  paintWatermelonHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.8);
}

// =====================================================
// SANDÍA — pulpa interior (foco principal de realismo)
//
// Capas (de fondo a frente):
//  1. Gradiente radial de color: rojo profundo → coral → blanco
//     (con fina banda verde de la cáscara interior)
//  2. FBM de "celularidad" (la pulpa de la sandía no es uniforme:
//     tiene zonas más densas y zonas con más jugo).
//  3. Vetas radiales (fibras conectoras) muy finas
//  4. Burbujas/destellos de jugo (especulares pintados)
//  5. Granitos minúsculos rojos más oscuros (cell pockets)
// =====================================================

function paintWatermelonFlesh(ctx, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) * 0.5;

  // -- 1. Gradiente radial. Las sandías reales tienen un degradado
  //       suave del corazón (rojo intenso) hacia la corteza,
  //       pasando por coral y luego un anillo blanco-rosado y
  //       finalmente verde de la cáscara interior. --
  const center = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  center.addColorStop(0.00, '#a30b22');     // corazón vino
  center.addColorStop(0.15, '#c81e3a');
  center.addColorStop(0.40, '#e23e54');
  center.addColorStop(0.62, '#f06477');     // coral
  center.addColorStop(0.80, '#f9b4b4');
  center.addColorStop(0.91, '#fde9e7');     // pre-corteza (casi blanco)
  center.addColorStop(0.965, '#fafdf2');    // corteza blanca
  center.addColorStop(1.00, '#bee78b');     // verde interior
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, W, H);

  // -- 2. FBM grueso para variar densidad (zonas más oscuras / zonas más claras) --
  // Pintado con "multiply" en alpha para no destruir el gradiente.
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) continue;

      const i = (y * W + x) * 4;

      // FBM grande: variación a gran escala
      const big = fbm2D(x / W * 4 + 13, y / H * 4 + 7, 4);
      // FBM medio: detalle de "celdas"
      const mid = fbm2D(x / W * 16 + 1, y / H * 16 + 9, 4);
      // FBM fino: micro-grano
      const fine = fbm2D(x / W * 80, y / H * 80, 3);

      // Combinamos: el dist nos dice cuánta pulpa estamos pintando
      // (cerca del centro queremos más oscuro/saturado)
      const radialBoost = (1 - dist) * 0.6;
      const variance = (big - 0.5) * 0.18 + (mid - 0.5) * 0.10 + (fine - 0.5) * 0.05;

      // Solo modulamos en la zona de pulpa rosada (no en la corteza/verde)
      if (dist < 0.88) {
        const factor = 1 + variance + radialBoost * 0.04;
        img.data[i + 0] = Math.max(0, Math.min(255, img.data[i + 0] * factor));
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] * (factor - radialBoost * 0.05)));
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] * (factor - radialBoost * 0.05)));
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // -- 3. Vetas radiales (fibras de pulpa). Son tenues pero visibles. --
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 480; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r1 = Math.random() * maxR * 0.20;
    const r2 = r1 + maxR * (0.2 + Math.random() * 0.55);
    const t1 = Math.cos(angle) * r1;
    const t2 = Math.sin(angle) * r1;
    const t3 = Math.cos(angle) * r2;
    const t4 = Math.sin(angle) * r2;
    const grad = ctx.createLinearGradient(t1, t2, t3, t4);
    grad.addColorStop(0, 'rgba(120, 8, 30, 0.0)');
    grad.addColorStop(0.4, `rgba(140, 12, 36, ${0.05 + Math.random() * 0.14})`);
    grad.addColorStop(1, 'rgba(255, 200, 200, 0.0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.4 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(t1, t2);
    // Curva ligera
    ctx.quadraticCurveTo(
      Math.cos(angle + 0.05) * (r1 + r2) / 2,
      Math.sin(angle + 0.05) * (r1 + r2) / 2,
      t3, t4,
    );
    ctx.stroke();
  }
  ctx.restore();

  // -- 4. "Cells" — pequeños puntitos más oscuros (los compartimentos
  //       celulares de la pulpa). Distribución radial. --
  for (let i = 0; i < 1100; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * maxR * 0.85;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const radial = r / maxR;
    if (radial > 0.9) continue;
    const dark = 0.10 + Math.random() * 0.18;
    ctx.fillStyle = `rgba(110, 6, 24, ${dark})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- 5. Highlights de jugo (puntos brillantes especulares pequeñísimos) --
  for (let i = 0; i < 1800; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * maxR * 0.85;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const sz = 0.5 + Math.random() * 1.6;
    ctx.fillStyle = `rgba(255, 240, 240, ${0.30 + Math.random() * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
    // halo suave
    ctx.fillStyle = `rgba(255, 240, 240, ${0.06 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, sz * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // -- 6. Anillo blanco-pre-corteza con textura más fibrosa (rind interior) --
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.965, 0, Math.PI * 2);
  ctx.arc(cx, cy, maxR * 0.88, 0, Math.PI * 2, true);
  ctx.clip();
  for (let i = 0; i < 600; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rr = maxR * (0.88 + Math.random() * 0.085);
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    ctx.strokeStyle = `rgba(${200 + Math.random() * 30 | 0}, ${190 + Math.random() * 25 | 0}, ${140 + Math.random() * 30 | 0}, ${0.18 + Math.random() * 0.22})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.8;
    const len = 4 + Math.random() * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // -- 7. Glaze sutil sobre el centro (humedad fresca) --
  const glaze = ctx.createRadialGradient(
    cx + maxR * 0.12, cy - maxR * 0.20, 0,
    cx + maxR * 0.12, cy - maxR * 0.20, maxR * 0.55,
  );
  glaze.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  glaze.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glaze;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

export function makeWatermelonFleshTexture() {
  // 1536² es el sweet-spot entre calidad y tiempo de generación FBM
  // (~1.5s en mid-range). A 2048² subiría a ~3s y la diferencia visual
  // a la distancia del visor 3D es imperceptible.
  const W = 1536, H = 1536;
  const canvas = makeCanvas(W, H);
  paintWatermelonFlesh(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

// Mapa de altura para la pulpa (muy sutil — la pulpa tiene textura
// granular pero no surcos profundos)
function paintWatermelonFleshHeight(ctx, W, H) {
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(W, H) * 0.5;

  // Base mid-gray
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  // FBM cellular pattern para los compartimentos celulares
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.97) continue;
      const i = (y * W + x) * 4;

      // Cellular noise para celdas
      const cell = cellular2D(x / W * 38, y / H * 38);
      const cellVal = Math.max(0, 1 - cell * 1.4); // 0..1
      // FBM detalle fino
      const fine = fbm2D(x / W * 120, y / H * 120, 3);

      // Centro: relieve más alto (celdas más visibles); corteza: plano
      const fade = dist < 0.88 ? 1 : (1 - (dist - 0.88) / 0.09);
      let v = 128 + (cellVal * 80 + (fine - 0.5) * 30) * fade;
      v = Math.max(20, Math.min(235, v));
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function makeWatermelonFleshNormalTexture() {
  const W = 768, H = 768;
  const canvas = makeCanvas(W, H);
  paintWatermelonFleshHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.1);
}

// Roughness variable: las gotas de jugo y zonas húmedas son más reflectivas;
// el blanco de la corteza es muy mate
export function makeWatermelonFleshRoughnessTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(W, H) * 0.5;

  // Base: la pulpa centro es ligeramente brillante
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  grad.addColorStop(0, '#5a5a5a');     // centro: rough medio (jugoso)
  grad.addColorStop(0.6, '#6a6a6a');
  grad.addColorStop(0.88, '#9a9a9a');  // corteza: rough alto (blanco mate)
  grad.addColorStop(1, '#c8c8c8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Puntos brillantes (gotas de jugo)
  for (let i = 0; i < 1500; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * maxR * 0.85;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const sz = 1 + Math.random() * 3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, sz);
    g.addColorStop(0, 'rgba(15,15,15,0.85)');
    g.addColorStop(1, 'rgba(15,15,15,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  return toLinearTexture(canvas);
}

// =====================================================
// FRIJOL — vaina exterior
// =====================================================

function paintPodColor(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#365314');
  grad.addColorStop(0.45, '#84cc16');
  grad.addColorStop(0.55, '#a3e635');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Modulación FBM grande (variación cromática orgánica)
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 6, y / H * 6, 4);
      const i = (y * W + x) * 4;
      const f = 0.85 + n * 0.3;
      img.data[i + 0] = Math.min(255, img.data[i + 0] * f);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * (0.9 + n * 0.25));
      img.data[i + 2] = Math.min(255, img.data[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Estriado longitudinal
  for (let i = 0; i < 110; i++) {
    const y = (i / 110) * H + Math.random() * 4;
    ctx.strokeStyle = `rgba(34, 64, 12, ${0.05 + Math.random() * 0.16})`;
    ctx.lineWidth = 0.4 + Math.random() * 1.0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 24) {
      ctx.lineTo(x, y + Math.sin(x * 0.04) * 1.6 + (fbm2D(x * 0.01, y * 0.01, 3) - 0.5) * 2);
    }
    ctx.stroke();
  }

  // Manchitas frescas (puntos verdes claros)
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(190, 240, 120, ${0.05 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + Math.random() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cera (highlights difusos)
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 30 + Math.random() * 80;
    const gd = ctx.createRadialGradient(x, y, 0, x, y, r);
    gd.addColorStop(0, 'rgba(220, 240, 180, 0.07)');
    gd.addColorStop(1, 'rgba(220, 240, 180, 0)');
    ctx.fillStyle = gd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Oscurecimiento en los extremos
  const ends = ctx.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(20, 50, 10, 0.6)');
  ends.addColorStop(0.08, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(0.92, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(1, 'rgba(20, 50, 10, 0.6)');
  ctx.fillStyle = ends;
  ctx.fillRect(0, 0, W, H);
}

export function makePodColorTexture() {
  const W = 2048, H = 512;
  const canvas = makeCanvas(W, H);
  paintPodColor(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintPodHeight(ctx, W, H) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * H;
    ctx.strokeStyle = `rgba(${30 + Math.random() * 40},${30 + Math.random() * 40},${30 + Math.random() * 40},0.6)`;
    ctx.lineWidth = 0.4 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 22) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 1.4);
    }
    ctx.stroke();
  }
  // Pequeños bumps al azar
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 110 + Math.random() * 130;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makePodNormalTexture() {
  const W = 1024, H = 256;
  const canvas = makeCanvas(W, H);
  paintPodHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.6);
}

// =====================================================
// FRIJOL — semilla (caupí / pinto)
// =====================================================

export function makeBeanSeedTexture() {
  const W = 1024, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Color base: el frijol caupí varía de crema a beige con un "ojo" oscuro,
  // pero también puede tener tonos vinos/marrones. Pintamos un beige cálido
  // base con FBM.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#cfa37a');
  grad.addColorStop(0.5, '#d8b48b');
  grad.addColorStop(1, '#a87852');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FBM grueso para variación cromática orgánica (manchas naturales)
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const big = fbm2D(x / W * 5, y / H * 5, 5);
      const fine = fbm2D(x / W * 28, y / H * 28, 3);
      const i = (y * W + x) * 4;
      // Mancha entre crema cálido y marrón rojizo
      const f = (big * 0.7 + fine * 0.3);
      const r = img.data[i + 0] * (0.7 + f * 0.6);
      const g = img.data[i + 1] * (0.6 + f * 0.55);
      const b = img.data[i + 2] * (0.55 + f * 0.5);
      img.data[i + 0] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Pequeños puntitos oscuros (motas naturales del frijol)
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 0.6 + Math.random() * 2.4;
    ctx.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${30 + Math.random() * 25 | 0},${15 + Math.random() * 20 | 0},${0.20 + Math.random() * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hilum (el "ojo" del frijol caupí: marca oscura en el centro de un lado)
  // En el caupí real es una mancha negra distintiva.
  const hilumCx = W * 0.5;
  const hilumCy = H * 0.5;
  const hilumGrad = ctx.createRadialGradient(hilumCx, hilumCy, 0, hilumCx, hilumCy, W * 0.10);
  hilumGrad.addColorStop(0, 'rgba(15, 8, 3, 0.92)');
  hilumGrad.addColorStop(0.4, 'rgba(40, 22, 10, 0.55)');
  hilumGrad.addColorStop(1, 'rgba(40, 22, 10, 0)');
  ctx.fillStyle = hilumGrad;
  ctx.beginPath();
  ctx.ellipse(hilumCx, hilumCy, W * 0.10, H * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Línea de hilum más pequeña (estría más oscura justo en el centro)
  ctx.strokeStyle = 'rgba(8, 4, 2, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(hilumCx, hilumCy, W * 0.045, H * 0.025, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Highlight especular tenue (humedad)
  const hl = ctx.createRadialGradient(W * 0.32, H * 0.28, 0, W * 0.32, H * 0.28, W * 0.5);
  hl.addColorStop(0, 'rgba(255, 240, 215, 0.22)');
  hl.addColorStop(1, 'rgba(255, 240, 215, 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, W, H);

  return toColorTexture(canvas);
}

// Normal map para el frijol (relieve sutil con hilum hundido)
export function makeBeanSeedNormalTexture() {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base media
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  // FBM bumps
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 18, y / H * 18, 4);
      const i = (y * W + x) * 4;
      const v = 100 + n * 80;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Hilum hundido (zona oscura → más bajo)
  const hg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.10);
  hg.addColorStop(0, 'rgba(0,0,0,0.9)');
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.5, W * 0.10, H * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  return normalTextureFromHeightCanvas(canvas, 1.0);
}

// =====================================================
// HOJA verde (frijol y sandía)
// =====================================================

function paintLeafColor(ctx, W, H) {
  // Base con gradiente y FBM para variación natural
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#274912');
  grad.addColorStop(0.5, '#4d7c0f');
  grad.addColorStop(1, '#1a2e05');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FBM para variación cromática
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 4, y / H * 4, 4);
      const i = (y * W + x) * 4;
      const f = 0.8 + n * 0.4;
      img.data[i + 0] = Math.min(255, img.data[i + 0] * f);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * (0.85 + n * 0.35));
      img.data[i + 2] = Math.min(255, img.data[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Vena central
  ctx.strokeStyle = 'rgba(20, 50, 10, 0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Venas secundarias
  ctx.strokeStyle = 'rgba(20, 50, 10, 0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 1; i < 16; i++) {
    const y = (i / 16) * H;
    const offsetX = (i % 2 === 0 ? 1 : -1) * 18;
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.quadraticCurveTo(W / 2 + offsetX * 4, y + 30, W / 2 + offsetX * 8, y + 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.quadraticCurveTo(W / 2 - offsetX * 4, y + 30, W / 2 - offsetX * 8, y + 80);
    ctx.stroke();
  }

  // Highlights translúcidos
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(180, 220, 120, ${0.04 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sutil moteado oscuro
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(20, 40, 8, ${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeLeafColorTexture() {
  const W = 512, H = 1024;
  const canvas = makeCanvas(W, H);
  paintLeafColor(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintLeafHeight(ctx, W, H) {
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  // Vena central elevada
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Venas secundarias elevadas
  ctx.strokeStyle = '#bbbbbb';
  ctx.lineWidth = 2;
  for (let i = 1; i < 16; i++) {
    const y = (i / 16) * H;
    const offsetX = (i % 2 === 0 ? 1 : -1) * 18;
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.quadraticCurveTo(W / 2 + offsetX * 4, y + 30, W / 2 + offsetX * 8, y + 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, y);
    ctx.quadraticCurveTo(W / 2 - offsetX * 4, y + 30, W / 2 - offsetX * 8, y + 80);
    ctx.stroke();
  }
}

export function makeLeafNormalTexture() {
  const W = 512, H = 1024;
  const canvas = makeCanvas(W, H);
  paintLeafHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.4);
}

// =====================================================
// HUSK (hoja de maíz)
// =====================================================

function paintHuskColor(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#cdb380');
  grad.addColorStop(0.35, '#a3a380');
  grad.addColorStop(0.65, '#84cc16');
  grad.addColorStop(0.92, '#65a30d');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FBM para variación cromática
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 6, y / H * 6, 5);
      const i = (y * W + x) * 4;
      const f = 0.85 + n * 0.3;
      img.data[i + 0] = Math.min(255, img.data[i + 0] * f);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * (0.9 + n * 0.25));
      img.data[i + 2] = Math.min(255, img.data[i + 2] * (0.8 + n * 0.4));
    }
  }
  ctx.putImageData(img, 0, 0);

  // Venas verticales
  for (let i = 0; i < 40; i++) {
    const x = (i / 40) * W;
    ctx.strokeStyle = `rgba(40, 70, 10, ${0.18 + Math.random() * 0.22})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 18) {
      ctx.lineTo(x + Math.sin(y * 0.02) * 1.6, y);
    }
    ctx.stroke();
  }

  // Manchas de sol y desgaste
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 5 + Math.random() * 18;
    ctx.fillStyle = `rgba(245, 230, 180, ${0.04 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeHuskColorTexture() {
  const W = 512, H = 2048;
  const canvas = makeCanvas(W, H);
  paintHuskColor(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintHuskHeight(ctx, W, H) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 35; i++) {
    const x = (i / 35) * W;
    ctx.strokeStyle = '#dcdcdc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 18) {
      ctx.lineTo(x + Math.sin(y * 0.02) * 1.6, y);
    }
    ctx.stroke();
  }
  // ruido fino
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 110 + Math.random() * 100;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + Math.random() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeHuskNormalTexture() {
  const W = 256, H = 1024;
  const canvas = makeCanvas(W, H);
  paintHuskHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.2);
}

// =====================================================
// VAINA INTERIOR (membrana del frijol abierta)
// =====================================================

export function makePodInteriorTexture() {
  const W = 1024, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base verde claro pálido (membrana interior)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#e9f3c9');
  grad.addColorStop(0.5, '#d8e8b2');
  grad.addColorStop(1, '#c1d795');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FBM variación
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 8, y / H * 8, 4);
      const i = (y * W + x) * 4;
      const f = 0.88 + n * 0.22;
      img.data[i + 0] = Math.min(255, img.data[i + 0] * f);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * f);
      img.data[i + 2] = Math.min(255, img.data[i + 2] * (f - 0.05));
    }
  }
  ctx.putImageData(img, 0, 0);

  // Compartimentos donde van los frijoles (sombras curvas)
  const compartments = 5;
  for (let i = 0; i < compartments; i++) {
    const cx = (i + 0.5) / compartments * W;
    const g = ctx.createRadialGradient(cx, H / 2, 0, cx, H / 2, W / compartments * 0.55);
    g.addColorStop(0, 'rgba(80, 100, 50, 0)');
    g.addColorStop(0.7, 'rgba(50, 80, 30, 0.18)');
    g.addColorStop(1, 'rgba(50, 80, 30, 0.45)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, H / 2, W / compartments * 0.5, H * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Línea media (sutura)
  ctx.strokeStyle = 'rgba(70, 110, 30, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  for (let x = 0; x <= W; x += 12) {
    ctx.lineTo(x, H / 2 + Math.sin(x * 0.05) * 2.5);
  }
  ctx.stroke();

  // Filamentos (placenta)
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.strokeStyle = `rgba(100, 130, 60, ${0.18 + Math.random() * 0.22})`;
    ctx.lineWidth = 0.3 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  return toColorTexture(canvas);
}
