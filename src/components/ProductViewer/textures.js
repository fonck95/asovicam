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

// Voronoi avanzado: devuelve F1 (distancia al más cercano), F2 (segundo más
// cercano), un id estable de la celda y la posición del feature point.
// Es el motor que da realismo a la pulpa de la sandía: cada celda es una
// "burbuja de jugo" con su tono propio y bordes oscuros donde se tocan dos
// celdas (justo lo que se ve al hacer macro a una sandía real).
//
// Usa distancia al cuadrado durante la comparación (evita ~7 sqrt por
// pixel × 9 vecinos) y sólo aplica sqrt a los valores finales f1, f2.
// Para texturas 1536² esto ahorra ~600ms en V8.
function voronoi2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1sq = 9.0;
  let f2sq = 9.0;
  let cellId = 0;
  let fpx = 0;
  let fpy = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const px = cx + hash2(cx, cy);
      const py = cy + hash2(cx + 13, cy + 7);
      const dx = px - x;
      const dy = py - y;
      const dsq = dx * dx + dy * dy;
      if (dsq < f1sq) {
        f2sq = f1sq;
        f1sq = dsq;
        cellId = hash2(cx + 11, cy + 5);
        fpx = px;
        fpy = py;
      } else if (dsq < f2sq) {
        f2sq = dsq;
      }
    }
  }
  return {
    f1: Math.sqrt(f1sq),
    f2: Math.sqrt(f2sq),
    cellId,
    fpx,
    fpy,
  };
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
// La pulpa de la sandía es tejido placentario: miles de células grandes,
// poligonales, llenas de agua con sacarosa. A simple vista cada celda es
// una "joyita" cristalina: brilla en su centro, se separa por una pared
// celular ligeramente más oscura y varía sutilmente de tono respecto a
// sus vecinas.
//
// Capas (de fondo a frente):
//  1. Gradiente radial fotométrico: corazón rubí → rojo sandía → coral
//     → rosa pálido → crema-blanco fibroso (interior de la cáscara).
//  2. **Voronoi cellular real**: cada celda obtiene su tono propio, un
//     borde oscuro y un highlight especular interno (esto es la firma
//     visual de la pulpa de sandía).
//  3. Haces vasculares radiando del centro (donde se anclan las semillas).
//  4. Anillo de transición fibroso al blanco interior de la cáscara.
//  5. Micro-gotas de jugo y glaze de humedad sobre toda la superficie.
// =====================================================

// Paleta de la pulpa: stops del gradiente radial. Diseñada a partir de
// fotos macro reales (corazón vino → coral saturado → rosa lácteo →
// transición crema antes del blanco interior).
const FLESH_STOPS = [
  { r: 0.00, c: [122, 10, 30] },   // corazón ruby/vino
  { r: 0.10, c: [184, 24, 54] },   // rojo profundo
  { r: 0.22, c: [216, 44, 70] },   // rojo sandía clásico
  { r: 0.38, c: [232, 72, 96] },   // rojo coral vivo
  { r: 0.58, c: [240, 130, 144] }, // coral pálido
  { r: 0.74, c: [248, 184, 192] }, // rosa pálido (mostly-water)
  { r: 0.84, c: [251, 224, 220] }, // pre-corteza rosado-crema
  { r: 0.91, c: [248, 240, 220] }, // blanco crema fibroso
  { r: 0.97, c: [228, 226, 192] }, // crema-amarillento (rind interior)
  { r: 1.00, c: [180, 200, 130] }, // verde tenue (cáscara interna)
];

function fleshRadialColor(t) {
  // Devuelve [r, g, b] interpolado en la paleta para t ∈ [0, 1]
  const tt = Math.max(0, Math.min(1, t));
  for (let i = 1; i < FLESH_STOPS.length; i++) {
    if (tt <= FLESH_STOPS[i].r) {
      const a = FLESH_STOPS[i - 1];
      const b = FLESH_STOPS[i];
      const lt = (tt - a.r) / (b.r - a.r);
      // Smooth Hermite — evita bandeo lineal en los gradientes
      const ls = lt * lt * (3 - 2 * lt);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * ls,
        a.c[1] + (b.c[1] - a.c[1]) * ls,
        a.c[2] + (b.c[2] - a.c[2]) * ls,
      ];
    }
  }
  return FLESH_STOPS[FLESH_STOPS.length - 1].c;
}

function paintWatermelonFlesh(ctx, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  // El UV mapping de la rebanada hace que sólo el disco interior
  // (texture-radius ≤ 0.5) sea visible — pintamos el patrón radial dentro
  // de un círculo de radio cx. El gradiente 0..1 cubre desde el centro
  // de la rebanada hasta el borde curvo.
  const maxR = Math.min(W, H) * 0.5;

  // --- Pase 1: por píxel calculamos color base + Voronoi + variaciones ---
  // Una sola escritura ImageData = ~4× más rápido que múltiples passes.
  const img = ctx.createImageData(W, H);
  const data = img.data;

  // Escala Voronoi: cada celda ≈ 1.2 mm en el modelo (radio rebanada
  // 0.78 unidades ≈ 7.8cm). Con scale=22 sobre 1536px, cada celda
  // ocupa ~1.5% del diámetro de la rebanada — se ve nítida pero no abruma.
  const VORONOI_SCALE = 22;
  // Anillo donde domina la pulpa rosada (pre-corteza empieza después)
  const FLESH_END = 0.83;

  for (let y = 0; y < H; y++) {
    const dyN = (y - cy) / maxR;
    for (let x = 0; x < W; x++) {
      const dxN = (x - cx) / maxR;
      const dist = Math.sqrt(dxN * dxN + dyN * dyN);
      const i = (y * W + x) * 4;

      // Fuera del disco visible — pintamos un fondo neutro claro
      // (no se ve, pero ayuda al mipmap a no sangrar magenta en bordes)
      if (dist > 1.02) {
        data[i + 0] = 235;
        data[i + 1] = 230;
        data[i + 2] = 200;
        data[i + 3] = 255;
        continue;
      }

      const angle = Math.atan2(dyN, dxN);

      // 1. Color radial base (gradiente fotométrico)
      let [r, g, b] = fleshRadialColor(dist);

      // 2. Voronoi celular — sólo en la zona de pulpa rosada
      if (dist < FLESH_END) {
        const v = voronoi2D((x / W) * VORONOI_SCALE, (y / H) * VORONOI_SCALE);

        // 2a. Tono propio por celda — cada celda recibe un offset cromático
        // pequeño (algunas más oscuras, otras más rosadas) para imitar la
        // variación natural de la madurez celular.
        const tone = (v.cellId - 0.5) * 0.18;       // ±9% en R
        const toneG = (hash2(v.cellId * 100, 7) - 0.5) * 0.14;
        const toneB = (hash2(v.cellId * 50, 23) - 0.5) * 0.10;
        r *= 1 + tone;
        g *= 1 + tone * 0.55 + toneG * 0.4;
        b *= 1 + tone * 0.35 + toneB * 0.5;

        // 2b. Borde celular — donde dos celdas se tocan (F2-F1 pequeño)
        // queda una pared más oscura. Imita la lignina/fibra entre células.
        const edge = v.f2 - v.f1;
        const borderStrength = 1 - smoothstep(0.0, 0.06, edge);
        r *= 1 - borderStrength * 0.22;
        g *= 1 - borderStrength * 0.30;
        b *= 1 - borderStrength * 0.32;

        // 2c. Highlight intra-celda — el "punto de luz" de cada celda,
        // ubicado cerca del feature point. Esto es lo que da el aspecto
        // de "joyas" o "perlas" cristalinas en una macro real.
        const cellLight = (1 - smoothstep(0.0, 0.42, v.f1)) *
                          (0.35 + v.cellId * 0.55);
        r += cellLight * 70;
        g += cellLight * 50;
        b += cellLight * 50;

        // 2d. Algunas celdas son notablemente más claras (sobremaduras /
        // saturadas de jugo) — distribución probabilística por id
        if (v.cellId > 0.85) {
          const overripe = (v.cellId - 0.85) / 0.15;
          r += overripe * 22;
          g += overripe * 14;
          b += overripe * 18;
        }
        // Y otras más oscuras (zonas con micro-cavidad de aire / sombra)
        if (v.cellId < 0.10) {
          const dark = (0.10 - v.cellId) / 0.10;
          r *= 1 - dark * 0.14;
          g *= 1 - dark * 0.22;
          b *= 1 - dark * 0.22;
        }
      }

      // 3. Haces vasculares radiales — la sandía tiene 3-4 placentas
      // donde se anclan las semillas. De ellas salen fibras tenues hacia
      // la corteza. Modeladas como FBM angular modulado por radio.
      if (dist > 0.04 && dist < FLESH_END) {
        // 6 "rayos" principales con FBM aleatorio para ondulación
        const fiberAng = angle * 6;
        const fiberFract = fiberAng - Math.floor(fiberAng);
        const fiberMid = Math.min(fiberFract, 1 - fiberFract);
        const fiberJitter = fbm2D(angle * 5, dist * 12, 3);
        const fiberCloseness = 1 - smoothstep(0.05, 0.20, fiberMid);
        const fiberFalloff = 1 - smoothstep(0.0, FLESH_END, dist);
        const fiberStrength = fiberCloseness * fiberJitter * fiberFalloff * 0.18;
        r *= 1 - fiberStrength * 0.20;
        g *= 1 - fiberStrength * 0.32;
        b *= 1 - fiberStrength * 0.30;
      }

      // 4. Micro-grano FBM — ruido fino que rompe regularidad Voronoi
      const fineN = fbm2D((x / W) * 110, (y / H) * 110, 3) - 0.5;
      const grainAmt = dist < FLESH_END ? 9 : 4;
      r += fineN * grainAmt;
      g += fineN * grainAmt * 0.85;
      b += fineN * grainAmt * 0.7;

      // 5. Pre-corteza fibrosa (anillo blanco entre pulpa y cáscara)
      // El blanco interno de la sandía no es uniforme: tiene fibras
      // radiales claramente visibles que apuntan a la cáscara.
      if (dist >= FLESH_END && dist < 0.96) {
        const t = (dist - FLESH_END) / (0.96 - FLESH_END); // 0..1
        // Fibras estiradas radialmente
        const fiberN = fbm2D(angle * 80, dist * 90, 3);
        const fiberN2 = valueNoise2D(angle * 140, dist * 30);
        const fibrousMod = (fiberN - 0.5) * 38 + (fiberN2 - 0.5) * 22;
        r += fibrousMod * (1 - t * 0.3);
        g += fibrousMod * (1 - t * 0.3);
        b += fibrousMod * 0.5;

        // Pequeña veteado verdoso conforme se acerca a la cáscara
        if (t > 0.5) {
          const greenTint = (t - 0.5) * 2 * 18;
          r -= greenTint * 0.4;
          b -= greenTint * 0.6;
        }
      }

      data[i + 0] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // --- Pase 2: detalles que se pintan mejor con primitivas ---

  // 6. Estrellas vasculares centrales — donde nacen los haces de semillas.
  // Tres líneas suaves que parten del centro y se diluyen en la pulpa.
  ctx.save();
  ctx.translate(cx, cy);
  for (let bundle = 0; bundle < 6; bundle++) {
    const baseAng = (bundle / 6) * Math.PI * 2 + (hash2(bundle, 17) - 0.5) * 0.4;
    const len = maxR * (0.55 + hash2(bundle, 31) * 0.20);
    // Curva con ligera ondulación
    const ctrlAng = baseAng + (hash2(bundle, 47) - 0.5) * 0.25;
    const cxa = Math.cos(ctrlAng) * len * 0.5;
    const cya = Math.sin(ctrlAng) * len * 0.5;
    const tipx = Math.cos(baseAng) * len;
    const tipy = Math.sin(baseAng) * len;

    const grad = ctx.createLinearGradient(0, 0, tipx, tipy);
    grad.addColorStop(0, 'rgba(95, 6, 22, 0.55)');
    grad.addColorStop(0.35, 'rgba(120, 14, 32, 0.20)');
    grad.addColorStop(1, 'rgba(255, 200, 190, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6 + hash2(bundle, 73) * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cxa, cya, tipx, tipy);
    ctx.stroke();

    // Filamentos secundarios alrededor de cada haz principal
    for (let s = 0; s < 5; s++) {
      const sa = baseAng + (hash2(bundle * 7 + s, 13) - 0.5) * 0.55;
      const sl = len * (0.55 + hash2(s, bundle) * 0.4);
      const stx = Math.cos(sa) * sl;
      const sty = Math.sin(sa) * sl;
      ctx.strokeStyle = `rgba(115, 12, 30, ${0.10 + hash2(s, bundle * 3) * 0.10})`;
      ctx.lineWidth = 0.4 + hash2(s, bundle * 5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        stx * 0.5 + (hash2(s, bundle * 11) - 0.5) * sl * 0.2,
        sty * 0.5 + (hash2(s, bundle * 13) - 0.5) * sl * 0.2,
        stx, sty,
      );
      ctx.stroke();
    }
  }
  ctx.restore();

  // 7. Gotitas de jugo — destellos especulares pintados directamente.
  // Más numerosas y pequeñas que antes, distribuidas con bias radial
  // (más densas hacia el centro donde la pulpa es más jugosa).
  for (let i = 0; i < 1400; i++) {
    const a = Math.random() * Math.PI * 2;
    const rt = Math.pow(Math.random(), 0.55) * maxR * FLESH_END;
    const x = cx + Math.cos(a) * rt;
    const y = cy + Math.sin(a) * rt;
    const sz = 0.5 + Math.random() * 1.5;
    const alpha = 0.32 + Math.random() * 0.45;
    ctx.fillStyle = `rgba(255, 245, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
    // Halo difuso
    const halo = ctx.createRadialGradient(x, y, 0, x, y, sz * 4);
    halo.addColorStop(0, 'rgba(255, 240, 235, 0.12)');
    halo.addColorStop(1, 'rgba(255, 240, 235, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, sz * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Marcas de cavidad de semilla — pequeñas zonas un poco más
  // oscuras donde se asentaría una semilla. Tres anillos en el
  // semicírculo superior (que es la parte visible de la rebanada
  // según el UV mapping). Las posiciones coinciden visualmente con
  // las semillas del modelo aunque la geometría no las clava al píxel.
  const seedRings = [
    { r: maxR * 0.42, count: 7 },
    { r: maxR * 0.58, count: 9 },
    { r: maxR * 0.74, count: 11 },
  ];
  for (const ring of seedRings) {
    for (let k = 0; k < ring.count; k++) {
      const t = (k + 0.5) / ring.count;
      const a = Math.PI - t * Math.PI; // sólo semicírculo superior
      const jitter = (hash2(ring.r, k) - 0.5) * 0.04 * maxR;
      const x = cx + Math.cos(a) * (ring.r + jitter);
      const y = cy + Math.sin(a) * (ring.r + jitter);
      const haloR = 16;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      halo.addColorStop(0, 'rgba(75, 5, 18, 0.50)');
      halo.addColorStop(0.55, 'rgba(95, 8, 22, 0.18)');
      halo.addColorStop(1, 'rgba(95, 8, 22, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. Glaze global — capa de humedad oblicua, simula reflejo del
  // softbox superior-izquierdo para look de marketing.
  const glaze = ctx.createRadialGradient(
    cx + maxR * 0.18, cy - maxR * 0.22, 0,
    cx + maxR * 0.18, cy - maxR * 0.22, maxR * 0.65,
  );
  glaze.addColorStop(0, 'rgba(255, 252, 245, 0.12)');
  glaze.addColorStop(0.6, 'rgba(255, 252, 245, 0.04)');
  glaze.addColorStop(1, 'rgba(255, 252, 245, 0)');
  ctx.fillStyle = glaze;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.95, 0, Math.PI * 2);
  ctx.fill();
}

export function makeWatermelonFleshTexture() {
  // 1536² es el sweet-spot calidad/tiempo. La función Voronoi añade ~1s
  // sobre el costo del pase FBM original, pero la diferencia visual
  // (cellularidad real y bordes oscuros entre células) es la base del
  // realismo fotográfico — bien vale la espera durante el loader.
  const W = 1536, H = 1536;
  const canvas = makeCanvas(W, H);
  paintWatermelonFlesh(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

// Mapa de altura para la pulpa: cada célula Voronoi se eleva como
// una pequeña burbuja plump (el centro alto), separada de sus vecinas
// por valles oscuros (donde está la pared celular). La escala Voronoi
// debe coincidir con la del color para que normal/color queden alineados.
function paintWatermelonFleshHeight(ctx, W, H) {
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(W, H) * 0.5;
  const VORONOI_SCALE = 22;
  const FLESH_END = 0.83;

  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.getImageData(0, 0, W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    const dyN = (y - cy) / maxR;
    for (let x = 0; x < W; x++) {
      const dxN = (x - cx) / maxR;
      const dist = Math.sqrt(dxN * dxN + dyN * dyN);
      if (dist > 0.97) continue;
      const i = (y * W + x) * 4;

      let h = 128;

      if (dist < FLESH_END) {
        const v = voronoi2D((x / W) * VORONOI_SCALE, (y / H) * VORONOI_SCALE);
        // Centro de celda: alto (plump); borde de celda: hundido
        const cellRise = 1 - smoothstep(0.0, 0.45, v.f1);
        const edge = v.f2 - v.f1;
        const valley = 1 - smoothstep(0.0, 0.07, edge);
        // Cada celda tiene su altura propia (algunas más infladas)
        const cellMaxH = 0.7 + v.cellId * 0.5;
        h = 110 + cellRise * 65 * cellMaxH - valley * 55;
        // Detalle fino para que la superficie no parezca cera
        const fine = fbm2D((x / W) * 130, (y / H) * 130, 3);
        h += (fine - 0.5) * 24;
      } else if (dist < 0.96) {
        // Pre-corteza fibrosa — fibras radiales finas
        const angle = Math.atan2(dyN, dxN);
        const fibers = fbm2D(angle * 72, dist * 80, 3);
        const fibers2 = valueNoise2D(angle * 140, dist * 28);
        h = 118 + (fibers - 0.5) * 70 + (fibers2 - 0.5) * 40;
      }

      const v = Math.max(20, Math.min(235, h));
      data[i + 0] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function makeWatermelonFleshNormalTexture() {
  // Sube la resolución del normal map: las celdas Voronoi (~1.5% del
  // diámetro) se aliasean en 768². 1024² da bordes nítidos sin coste alto.
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  paintWatermelonFleshHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.4);
}

// Roughness variable: el centro de cada célula Voronoi es muy brillante
// (jugo expuesto), las paredes celulares son ligeramente más mates,
// y la pre-corteza blanca es muy mate (textura fibrosa-seca).
export function makeWatermelonFleshRoughnessTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(W, H) * 0.5;
  const VORONOI_SCALE = 22;
  const FLESH_END = 0.83;

  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    const dyN = (y - cy) / maxR;
    for (let x = 0; x < W; x++) {
      const dxN = (x - cx) / maxR;
      const dist = Math.sqrt(dxN * dxN + dyN * dyN);
      const i = (y * W + x) * 4;

      let rough = 0.55;

      if (dist < FLESH_END) {
        const v = voronoi2D((x / W) * VORONOI_SCALE, (y / H) * VORONOI_SCALE);
        // Centro celular: muy brillante (jugo). Borde: ligeramente mate.
        const cellWet = 1 - smoothstep(0.0, 0.40, v.f1);
        const edge = v.f2 - v.f1;
        const borderDry = 1 - smoothstep(0.0, 0.06, edge);
        rough = 0.55 - cellWet * 0.40 + borderDry * 0.18;
        // Variación FBM fina (algunas zonas más jugosas que otras)
        rough += (fbm2D((x / W) * 90, (y / H) * 90, 3) - 0.5) * 0.10;
      } else if (dist < 0.96) {
        // Pre-corteza: bastante mate, con micro-variación
        const fiber = fbm2D((x / W) * 80, (y / H) * 80, 3);
        rough = 0.85 + (fiber - 0.5) * 0.10;
      } else {
        rough = 0.78;
      }

      // Bias adicional cerca del centro: el corazón es ligeramente
      // más brillante (más maduro = más agua libre)
      if (dist < 0.4) rough -= (0.4 - dist) * 0.10;

      rough = Math.max(0.12, Math.min(0.95, rough));
      const r255 = (rough * 255) | 0;
      data[i + 0] = r255;
      data[i + 1] = r255;
      data[i + 2] = r255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Gotitas brillantes adicionales (mismo seed-look que el color)
  for (let i = 0; i < 800; i++) {
    const a = Math.random() * Math.PI * 2;
    const rt = Math.pow(Math.random(), 0.55) * maxR * FLESH_END;
    const x = cx + Math.cos(a) * rt;
    const y = cy + Math.sin(a) * rt;
    const sz = 1 + Math.random() * 2.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, sz);
    g.addColorStop(0, 'rgba(10,10,10,0.85)');
    g.addColorStop(1, 'rgba(10,10,10,0)');
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
