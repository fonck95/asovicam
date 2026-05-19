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
// SANDÍA — Roughness map de la cáscara (PBR microfaceta)
//
// Anti-patrón explícito: "Roughness uniforme en toda la superficie".
// La sandía real tiene una distribución muy heterogénea de cera
// epicuticular concentrada en las franjas oscuras (más pulidas)
// y abrasiones/manchas distribuidas (mate). GGX integrado con esta
// rugosidad produce highlights ROTOS — la firma visual de la fruta
// fresca frente al renderizado "plástico".
//
// El layout (franjas + ondulación) replica el de paintWatermelonHeight
// para que el highlight especular se reposicione exactamente donde
// la geometría dicta (alineamiento canal-a-canal con color y normal).
// =====================================================
export function makeWatermelonRindRoughnessTexture() {
  const W = 1024, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base ~0.60 (lámina entre franjas, más expuesta y abrasionada)
  ctx.fillStyle = '#9c9c9c';
  ctx.fillRect(0, 0, W, H);

  // FBM macro/micro: variación cera fresca ↔ wax abrasionado a escala
  // grande y pequeña. Sin esto, las franjas se leen como anillos uniformes.
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const macro = fbm2D(x / W * 3.4, y / H * 3.4, 4);
      const micro = fbm2D(x / W * 22, y / H * 22, 3);
      const i = (y * W + x) * 4;
      // ∈ [~0.32, ~0.65] tras la composición
      const v = 110 + (macro - 0.5) * 60 + (micro - 0.5) * 28;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Franjas oscuras = wax depositado = MÁS PULIDO (roughness ~0.30).
  // Mismo perfil ondulado que el height map para alineamiento exacto
  // con la geometría aparente de las rayas.
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
    ctx.fillStyle = 'rgba(75, 75, 75, 0.85)';
    ctx.fill();
    ctx.restore();
  }

  // Cicatrices/manchas: islas MUY mates (cera ausente, tejido seco).
  // Empuja el highlight a romper alrededor (forma de "estrella" cuando
  // hay una luz fuerte), patrón inconfundiblemente real.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1.5 + Math.random() * 3.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, 'rgba(220, 220, 220, 0.85)');
    g.addColorStop(1, 'rgba(220, 220, 220, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Halos suaves de "polvo agrícola" (mate distribuido)
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 4 + Math.random() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(190, 190, 190, 0.30)');
    g.addColorStop(1, 'rgba(190, 190, 190, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return toLinearTexture(canvas);
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

// Paleta de la pulpa: stops del gradiente radial. RECALIBRADA hacia
// rojo verdadero sandía-madura (NO rosa): la versión anterior llegaba
// a coral [222,102,110] al 84% del radio, lo que combinado con bevel
// + transmisión producía una pulpa que se leía rosa-pastel en lugar
// de roja jugosa. Esta paleta mantiene rojo saturado hasta el 88% del
// radio y comprime toda la transición a coral/rosa/crema en una banda
// fina del 9% antes del rind verde.
const FLESH_STOPS = [
  { r: 0.00, c: [132, 10, 26] },   // corazón ruby/vino muy profundo
  { r: 0.06, c: [172, 16, 38] },   // wine red
  { r: 0.14, c: [200, 22, 46] },   // rojo profundo saturado
  { r: 0.30, c: [218, 28, 50] },   // ★ rojo sandía clásico (banda principal)
  { r: 0.58, c: [222, 32, 54] },   // rojo vibrante mantenido (mínimo shift)
  { r: 0.78, c: [218, 42, 60] },   // rojo cálido (sin pivotar a coral)
  { r: 0.88, c: [208, 70, 76] },   // coral profundo (transición arrancando)
  { r: 0.92, c: [222, 142, 138] }, // coral-rosa (banda fina de transición)
  { r: 0.95, c: [240, 214, 192] }, // rosa-crema (pre-corteza fibrosa)
  { r: 0.97, c: [228, 224, 184] }, // crema-amarillento (rind interior)
  { r: 1.00, c: [178, 200, 128] }, // verde tenue (cáscara interna)
];

// =====================================================
// Layout determinístico de semillas para la rebanada.
// Antes había 3 anillos concéntricos con conteos {7,9,11} — patrón
// matemático que se delataba como artificial al primer vistazo. Las
// sandías reales no tienen semillas en círculos perfectos: las
// semillas siguen las PLACENTAS (3 tabiques cárpelares) que se
// proyectan radialmente desde el corazón con curvatura propia y
// distribución irregular dentro de cada banda.
//
// Este generador comparte la misma fuente entre la malla 3D
// (semillas embebidas) y el canvas 2D (cavidades pintadas bajo cada
// semilla), de modo que ambas se alinean exactamente. Posiciones
// normalizadas (nx, ny) ∈ unidades de SLICE_RADIUS, con ny ≥ 0 para
// quedar en el semicírculo visible del corte.
// =====================================================
export function generateWatermelonSeedLayout() {
  // RNG LCG con seed fijo — la misma distribución cada vez que se
  // monta el modelo (importante para alinear textura y 3D).
  let state = 0x6f0d9c1d;
  const rng = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const seeds = [];
  // 3 placentas curvadas en el semicírculo superior. Ángulos base
  // ligeramente off-center y curvaturas heterogéneas para romper
  // simetría visual.
  const placentas = [
    { ang0: Math.PI * 0.30, curvature: 0.20, density: 11 },
    { ang0: Math.PI * 0.50, curvature: -0.09, density: 13 },
    { ang0: Math.PI * 0.70, curvature: 0.17, density: 11 },
  ];

  for (let p = 0; p < placentas.length; p++) {
    const pl = placentas[p];
    for (let i = 0; i < pl.density; i++) {
      // ~12% de huecos — placentas reales saltan posiciones
      if (rng() < 0.12) continue;
      // Parámetro 0..1 a lo largo de la placenta. Le aplicamos un
      // desplazamiento estocástico pequeño para que las semillas no
      // queden equiespaciadas dentro del bunch.
      const t = (i + 0.20 + rng() * 0.55) / pl.density;
      // Radio sub-linear: más densas hacia el medio que en los
      // extremos (concentración natural por elongación carpelar).
      const r = 0.20 + Math.pow(t, 0.92) * 0.62;
      // Curvatura sinusoidal: ángulo varía con t.
      const ang = pl.ang0 + Math.sin(t * Math.PI) * pl.curvature
                + (rng() - 0.5) * 0.10;
      const radJ = (rng() - 0.5) * 0.07;
      const tangJ = (rng() - 0.5) * 0.13;
      const nx = Math.cos(ang) * (r + radJ) - Math.sin(ang) * tangJ;
      const ny = Math.sin(ang) * (r + radJ) + Math.cos(ang) * tangJ;
      // Evitar el borde inferior del corte y el rind exterior.
      if (ny < 0.03 || r > 0.86) continue;
      seeds.push({
        nx,
        ny,
        // Rotación: alineada con la dirección de la placenta + jitter
        rotZ: ang + Math.PI / 2 + (rng() - 0.5) * 0.7,
        scale: 0.72 + rng() * 0.50,
        // Profundidad estocástica: algunas semillas más expuestas que
        // otras (variación ±15% del offset frontal en la malla 3D).
        depthOffset: (rng() - 0.5) * 0.012,
      });
    }
  }
  return seeds;
}

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
  // Capa secundaria de Voronoi (mucho más densa) para añadir granularidad
  // celular — imita las micro-vesículas dentro de cada celda grande.
  const VORONOI_FINE = 70;
  // La pulpa madura ocupa casi todo el radio: sólo ~5% de pre-corteza
  // blanca antes del rind verde. Antes era 0.83 → demasiado blanco.
  // FLESH_END/PRECRUST_END son los valores BASE; cada píxel obtiene una
  // pequeña ondulación angular para que la frontera no sea un círculo
  // perfecto (ver `wobble` dentro del loop).
  const FLESH_END = 0.91;
  const PRECRUST_END = 0.96;

  for (let y = 0; y < H; y++) {
    const dyN = (y - cy) / maxR;
    for (let x = 0; x < W; x++) {
      const dxN = (x - cx) / maxR;
      const dist = Math.sqrt(dxN * dxN + dyN * dyN);
      const i = (y * W + x) * 4;
      // Frontera pulpa↔pre-corteza ligeramente ondulada (no círculo
      // perfecto). La pulpa real avanza hacia la cáscara en lóbulos
      // suaves siguiendo los haces vasculares.
      const angRaw = Math.atan2(dyN, dxN);
      const boundaryWobble = (fbm2D(angRaw * 1.4 + 7, dist * 0.6, 2) - 0.5) * 0.020;
      const fleshEnd = FLESH_END + boundaryWobble;
      const precrustEnd = PRECRUST_END + boundaryWobble * 0.6;

      // Fuera del disco visible — pintamos verde-rind en lugar de
      // cream para que cualquier sangrado por bevel o anisotropic
      // no inyecte beige-blanco en los bordes (sangrar verde es
      // coherente con la cáscara que envuelve la rebanada).
      if (dist > 1.02) {
        data[i + 0] = 90;
        data[i + 1] = 120;
        data[i + 2] = 50;
        data[i + 3] = 255;
        continue;
      }

      const angle = Math.atan2(dyN, dxN);

      // 1. Color radial base (gradiente fotométrico)
      let [r, g, b] = fleshRadialColor(dist);

      // 1b. Variación cromática de GRAN ESCALA — el problema antes
      // era que el gradiente radial era perfectamente simétrico y
      // suave, lo que se leía como "render plástico". Una sandía real
      // tiene parches asimétricos: zonas algo más wine, otras más rojo
      // brillante, y bandas que cortan oblicuamente la pulpa. Usamos
      // dos FBM de baja frecuencia (3-5 ciclos sobre todo el disco)
      // para introducir esa irregularidad sin destruir el gradiente
      // base. Restringido a la zona de pulpa.
      if (dist < fleshEnd * 0.98) {
        const macro = fbm2D((x / W) * 3.2, (y / H) * 3.2, 4) - 0.5;
        const macroSwing = (1 - Math.pow(dist / FLESH_END, 1.4)) * 22;
        r += macro * macroSwing;
        g += macro * macroSwing * 0.35;
        b += macro * macroSwing * 0.25;

        const macro2 = fbm2D((x / W) * 5.6 + 47, (y / H) * 5.6 + 19, 3) - 0.5;
        r += macro2 * 11;
        g -= macro2 * 5;
        b -= macro2 * 3;

        // Manchas wine localizadas — sólo donde el ruido grande supera
        // un umbral, se hunde la luminosidad. Da el efecto de "zonas
        // más maduras" sin teñir la pulpa entera.
        const patch = valueNoise2D((x / W) * 4.5 + 11, (y / H) * 4.5 + 31);
        if (patch > 0.62) {
          const p = smoothstep(0.62, 0.85, patch);
          r *= 1 - p * 0.10;
          g *= 1 - p * 0.18;
          b *= 1 - p * 0.16;
        }
      }

      // 2. Voronoi celular — pulpa roja con variación por saturación
      if (dist < fleshEnd) {
        const v = voronoi2D((x / W) * VORONOI_SCALE, (y / H) * VORONOI_SCALE);

        // 2a. Variación por celda en SATURACIÓN: las celdas "claras"
        // empujan rojo (cálido), las oscuras se hunden en wine. Antes
        // los desplazamientos cruzados de r/g/b creaban un balance que
        // visualmente leía rosado. Ahora reducimos el shift de g/b para
        // que la variación sea dentro de la familia roja, no entre rojo
        // y rosa.
        const cellVar = v.cellId - 0.5;             // -0.5..+0.5
        r *= 1 + cellVar * 0.12;                    // ±6% rojo
        g *= 1 - cellVar * 0.04;
        b *= 1 - cellVar * 0.06;

        // Tinte estocástico por celda — algunas más ruby, otras más
        // crimson; sin desviarse a coral. Reducido el factor que
        // permitía pivotar a rosa.
        const cellHue = (hash2(v.cellId * 100, 7) - 0.5) * 14;
        r += cellHue * 0.7;
        g -= cellHue * 0.2;
        b -= cellHue * 0.1;

        // 2b. Borde celular — pared dura entre células. Más profundo
        // (oscurece más g y b que r) para que los bordes lean wine
        // contra el centro rojo claro.
        const edge = v.f2 - v.f1;
        const borderStrength = 1 - smoothstep(0.0, 0.07, edge);
        r *= 1 - borderStrength * 0.32;
        g *= 1 - borderStrength * 0.46;
        b *= 1 - borderStrength * 0.48;

        // 2c. Highlight intra-celda — destello "joya" cristalino con
        // dominante muy roja. Antes el +56 R / +18 G subía la
        // luminosidad media y desplazaba el tono a rosa-coral.
        // Recalibrado para que el highlight sea rojo brillante sin
        // levantar mucho la saturación verde/azul.
        const cellLight = (1 - smoothstep(0.0, 0.40, v.f1)) *
                          (0.28 + v.cellId * 0.42);
        r += cellLight * 48;
        g += cellLight * 10;
        b += cellLight * 12;

        // 2d. Capa fina secundaria de Voronoi: micro-vesículas dentro
        // de cada celda grande (cada celda real contiene miles de
        // pequeñas células llenas de jugo). Da textura de "azúcar"
        // cristalino que el ojo asocia con jugosidad.
        const vf = voronoi2D((x / W) * VORONOI_FINE, (y / H) * VORONOI_FINE);
        const fineCenter = 1 - smoothstep(0.0, 0.32, vf.f1);
        const fineEdge = 1 - smoothstep(0.0, 0.05, vf.f2 - vf.f1);
        // Micro-highlights rojos (no rosados): bajamos los aportes
        // verdes/azules para que el sparkle se vea como "punto de
        // azúcar rojo" no como destello blanco-rosado.
        r += fineCenter * 18;
        g += fineCenter * 3;
        b += fineCenter * 4;
        // Micro-bordes apenas perceptibles
        r *= 1 - fineEdge * 0.06;
        g *= 1 - fineEdge * 0.12;
        b *= 1 - fineEdge * 0.12;

        // 2e. Celdas más oscuras (micro-cavidad / sombra interna)
        if (v.cellId < 0.12) {
          const dark = (0.12 - v.cellId) / 0.12;
          r *= 1 - dark * 0.16;
          g *= 1 - dark * 0.30;
          b *= 1 - dark * 0.32;
        }
        // Celdas sobremaduras: wine más profundo (manteniendo rojez)
        if (v.cellId > 0.88) {
          const overripe = (v.cellId - 0.88) / 0.12;
          r *= 1 - overripe * 0.03;
          g *= 1 - overripe * 0.22;
          b *= 1 - overripe * 0.20;
        }

        // 2f. Boost de saturación radial: el corazón es más wine,
        // hacia el ecuador más rojo brillante. Refuerza el gradiente
        // rojo y previene el "lavado" hacia coral.
        const satBoost = (1 - dist / FLESH_END) * 0.08 + 0.04;
        const lum = (r + g + b) / 3;
        r = lum + (r - lum) * (1 + satBoost);
        g = lum + (g - lum) * (1 + satBoost);
        b = lum + (b - lum) * (1 + satBoost);
      }

      // 3. Haces vasculares radiales — la sandía tiene 3-4 placentas
      // donde se anclan las semillas. De ellas salen fibras tenues hacia
      // la corteza. Modeladas como FBM angular modulado por radio.
      if (dist > 0.04 && dist < fleshEnd) {
        // 6 "rayos" principales con FBM aleatorio para ondulación
        const fiberAng = angle * 6;
        const fiberFract = fiberAng - Math.floor(fiberAng);
        const fiberMid = Math.min(fiberFract, 1 - fiberFract);
        const fiberJitter = fbm2D(angle * 5, dist * 12, 3);
        const fiberCloseness = 1 - smoothstep(0.05, 0.22, fiberMid);
        const fiberFalloff = 1 - smoothstep(0.0, FLESH_END, dist);
        const fiberStrength = fiberCloseness * fiberJitter * fiberFalloff * 0.22;
        // Las venas son rojas-oscuras (vino), no grises — refuerzan
        // la dominante roja en lugar de desaturar.
        r *= 1 - fiberStrength * 0.18;
        g *= 1 - fiberStrength * 0.42;
        b *= 1 - fiberStrength * 0.40;

        // Vasos finos secundarios (más numerosos, ondulación fina)
        const fineFiberAng = angle * 18;
        const fineFract = fineFiberAng - Math.floor(fineFiberAng);
        const fineMid = Math.min(fineFract, 1 - fineFract);
        const fineCloseness = 1 - smoothstep(0.10, 0.28, fineMid);
        const fineFiber = fineCloseness * fbm2D(angle * 30, dist * 40, 2)
                          * fiberFalloff * 0.10;
        r *= 1 - fineFiber * 0.12;
        g *= 1 - fineFiber * 0.30;
        b *= 1 - fineFiber * 0.28;
      }

      // 4. Micro-grano FBM — ruido fino que rompe regularidad Voronoi
      const fineN = fbm2D((x / W) * 110, (y / H) * 110, 3) - 0.5;
      const grainAmt = dist < fleshEnd ? 11 : 4;
      r += fineN * grainAmt;
      g += fineN * grainAmt * 0.55;
      b += fineN * grainAmt * 0.55;

      // 4b. Capa adicional de "moteado" rojo profundo — sutiles puntos
      // más oscuros distribuidos en la pulpa (cromatóforos / azúcar
      // localmente más concentrada). Aumenta la sensación de profundidad.
      if (dist < fleshEnd * 0.96) {
        const speckle = valueNoise2D((x / W) * 220, (y / H) * 220);
        if (speckle > 0.78) {
          const sp = (speckle - 0.78) / 0.22;
          r *= 1 - sp * 0.14;
          g *= 1 - sp * 0.24;
          b *= 1 - sp * 0.24;
        }
      }

      // 4c. Fibras radiales finas — el tejido placentario de la sandía
      // tiene fibras tenues que viajan desde el corazón hacia la corteza,
      // visibles en macro como rayas pálidas-amarillentas casi rectas.
      // Las renderizamos como un ruido FBM modulado por una función
      // angular de alta frecuencia, restringido a la pulpa madura.
      if (dist > 0.05 && dist < fleshEnd * 0.94) {
        const radialFiberAng = angle * 38;
        const rfFract = radialFiberAng - Math.floor(radialFiberAng);
        const rfMid = Math.min(rfFract, 1 - rfFract);
        const rfCloseness = 1 - smoothstep(0.05, 0.18, rfMid);
        const rfNoise = fbm2D(angle * 22, dist * 28, 2);
        const fiberStrength = rfCloseness * rfNoise *
                              (1 - smoothstep(0, FLESH_END, dist)) * 0.18;
        // Fibras pálidas cálidas — empujan rojo abajo, otros un poco arriba
        // (efecto desaturación local muy sutil que da la línea fibrosa).
        r += fiberStrength * 4;
        g += fiberStrength * 14;
        b += fiberStrength * 10;
      }

      // 4d. Cristales de azúcar — micro-destellos blanquecinos muy
      // pequeños y dispersos, característicos de sandía dulce madura.
      // Aparecen sólo donde el ruido alcanza umbrales altos para
      // mantenerlos escasos y puntuales (no una capa global).
      if (dist < fleshEnd * 0.92) {
        const sugar = valueNoise2D((x / W) * 480, (y / H) * 480);
        if (sugar > 0.86) {
          const sg = (sugar - 0.86) / 0.14;
          r += sg * 24;
          g += sg * 18;
          b += sg * 14;
        }
      }

      // 5. Pre-corteza fibrosa: BANDA DELGADA entre pulpa y cáscara.
      // En la sandía real es ~5% del radio — el blanco aquí es fibroso
      // con vetas radiales muy marcadas, no homogéneo.
      if (dist >= fleshEnd && dist < precrustEnd) {
        const t = (dist - fleshEnd) / (precrustEnd - fleshEnd); // 0..1
        // Fibras estiradas radialmente — alta frecuencia angular
        const fiberN = fbm2D(angle * 90, dist * 95, 3);
        const fiberN2 = valueNoise2D(angle * 160, dist * 32);
        const fibrousMod = (fiberN - 0.5) * 42 + (fiberN2 - 0.5) * 26;
        r += fibrousMod * (1 - t * 0.3);
        g += fibrousMod * (1 - t * 0.3);
        b += fibrousMod * 0.5;

        // Veteado rojizo en la mitad interior (transición pulpa→blanco)
        if (t < 0.45) {
          const redBleed = (0.45 - t) / 0.45;
          r += redBleed * 14;
          g -= redBleed * 8;
          b -= redBleed * 6;
        }
        // Veteado verdoso al acercarse a la cáscara
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

  // 6a. CORAZÓN RUBY: cluster oscuro saturado en el centro — donde se
  // anclan las semillas y la pulpa es más densa. Da profundidad real.
  const heartGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.18);
  heartGrad.addColorStop(0, 'rgba(76, 6, 18, 0.55)');
  heartGrad.addColorStop(0.5, 'rgba(96, 10, 24, 0.32)');
  heartGrad.addColorStop(1, 'rgba(120, 14, 32, 0)');
  ctx.fillStyle = heartGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // 6b. Estrellas vasculares centrales — donde nacen los haces de semillas.
  // Líneas curvas, gradiente ruby → coral → fade.
  ctx.save();
  ctx.translate(cx, cy);
  for (let bundle = 0; bundle < 7; bundle++) {
    const baseAng = (bundle / 7) * Math.PI * 2 + (hash2(bundle, 17) - 0.5) * 0.4;
    const len = maxR * (0.62 + hash2(bundle, 31) * 0.22);
    const ctrlAng = baseAng + (hash2(bundle, 47) - 0.5) * 0.28;
    const cxa = Math.cos(ctrlAng) * len * 0.5;
    const cya = Math.sin(ctrlAng) * len * 0.5;
    const tipx = Math.cos(baseAng) * len;
    const tipy = Math.sin(baseAng) * len;

    const grad = ctx.createLinearGradient(0, 0, tipx, tipy);
    grad.addColorStop(0, 'rgba(70, 4, 16, 0.70)');
    grad.addColorStop(0.30, 'rgba(110, 12, 28, 0.32)');
    grad.addColorStop(0.65, 'rgba(170, 30, 50, 0.14)');
    grad.addColorStop(1, 'rgba(220, 90, 100, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8 + hash2(bundle, 73) * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cxa, cya, tipx, tipy);
    ctx.stroke();

    // Filamentos secundarios — más numerosos y dramáticos
    for (let s = 0; s < 7; s++) {
      const sa = baseAng + (hash2(bundle * 7 + s, 13) - 0.5) * 0.65;
      const sl = len * (0.45 + hash2(s, bundle) * 0.5);
      const stx = Math.cos(sa) * sl;
      const sty = Math.sin(sa) * sl;
      ctx.strokeStyle = `rgba(95, 8, 22, ${0.14 + hash2(s, bundle * 3) * 0.16})`;
      ctx.lineWidth = 0.5 + hash2(s, bundle * 5) * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        stx * 0.5 + (hash2(s, bundle * 11) - 0.5) * sl * 0.25,
        sty * 0.5 + (hash2(s, bundle * 13) - 0.5) * sl * 0.25,
        stx, sty,
      );
      ctx.stroke();
    }
  }
  ctx.restore();

  // 7. Gotitas de jugo — destellos especulares puntuales con tono
  // rojo-cálido (NO rosa). Cantidad y opacidad reducidas respecto a
  // la versión anterior — antes 1900 drops a alpha 0.28-0.70 elevaba
  // la luminosidad media de la pulpa y la teñía rosa-pastel. Ahora
  // 1100 drops más pequeños y con halo prácticamente desaturado.
  for (let i = 0; i < 1100; i++) {
    const a = Math.random() * Math.PI * 2;
    const rt = Math.pow(Math.random(), 0.55) * maxR * FLESH_END;
    const x = cx + Math.cos(a) * rt;
    const y = cy + Math.sin(a) * rt;
    const sz = 0.3 + Math.random() * 1.3;
    const alpha = 0.20 + Math.random() * 0.30;
    // Mezcla: la mayoría son destellos cálidos rojos (no rosados)
    // y un pequeño porcentaje blancos puros para variación.
    const warmDrop = Math.random() < 0.72;
    const fillCol = warmDrop
      ? `rgba(255, 200, 195, ${alpha})`   // rojo-cálido (no rosa)
      : `rgba(255, 246, 238, ${alpha * 0.78})`;
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
    // Halo más cerrado y tenue
    const halo = ctx.createRadialGradient(x, y, 0, x, y, sz * 3.6);
    halo.addColorStop(0, 'rgba(255, 200, 200, 0.07)');
    halo.addColorStop(1, 'rgba(255, 200, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, sz * 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Cavidades de semilla con halo MÁS PROFUNDO Y CONTRASTADO.
  // Usan el MISMO layout placental que la malla 3D (las semillas
  // reales se montan sobre estas cavidades), por lo que la cavidad
  // pintada queda alineada bajo cada semilla y se siente que la
  // semilla está "asentada" en una huella oscura de la pulpa, no
  // flotando sobre la superficie.
  const seedLayout = generateWatermelonSeedLayout();
  for (const s of seedLayout) {
    const x = cx + s.nx * maxR;
    const y = cy + s.ny * maxR;
    // Tamaño del halo modulado por la escala de la semilla 3D —
    // semillas pequeñas dejan huella más pequeña.
    const haloR = 14 + s.scale * 10;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0, 'rgba(55, 2, 12, 0.62)');     // bowl central
    halo.addColorStop(0.40, 'rgba(85, 6, 20, 0.30)');  // wine anillo
    halo.addColorStop(0.70, 'rgba(140, 18, 36, 0.10)'); // ruby fade
    halo.addColorStop(1, 'rgba(140, 18, 36, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fill();
    // Highlight cálido en el borde superior-izq de cada cavidad
    const sheenG = ctx.createRadialGradient(x - 3, y - 3, 0, x - 3, y - 3, 6);
    sheenG.addColorStop(0, 'rgba(255, 215, 215, 0.32)');
    sheenG.addColorStop(1, 'rgba(255, 215, 215, 0)');
    ctx.fillStyle = sheenG;
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9. Glaze de marketing: softbox superior-izq muy tenue. Bajamos
  // la opacidad para que el glaze no aporte rosa-claro al frame:
  // ahora sólo aporta un destello focal sin lavar la saturación.
  const glaze = ctx.createRadialGradient(
    cx + maxR * 0.18, cy - maxR * 0.22, 0,
    cx + maxR * 0.18, cy - maxR * 0.22, maxR * 0.60,
  );
  glaze.addColorStop(0, 'rgba(255, 224, 210, 0.06)');
  glaze.addColorStop(0.6, 'rgba(255, 224, 210, 0.02)');
  glaze.addColorStop(1, 'rgba(255, 224, 210, 0)');
  ctx.fillStyle = glaze;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // 10. Saturación global al rojo (multiply) — reforzada respecto a la
  // versión anterior para empujar el frame entero hacia pulpa madura.
  // Sólo en la zona de pulpa (no toca pre-corteza ni rind).
  const sat = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * FLESH_END);
  sat.addColorStop(0, 'rgba(216, 22, 44, 0.10)');
  sat.addColorStop(0.7, 'rgba(216, 22, 44, 0.06)');
  sat.addColorStop(1, 'rgba(216, 22, 44, 0)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = sat;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * FLESH_END, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
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
  const VORONOI_FINE = 70;
  // Mismas constantes que el color para que normal y color queden alineados
  const FLESH_END = 0.91;
  const PRECRUST_END = 0.96;

  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.getImageData(0, 0, W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    const dyN = (y - cy) / maxR;
    for (let x = 0; x < W; x++) {
      const dxN = (x - cx) / maxR;
      const dist = Math.sqrt(dxN * dxN + dyN * dyN);
      if (dist > 0.98) continue;
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
        h = 110 + cellRise * 70 * cellMaxH - valley * 60;

        // Capa fina: micro-vesículas (detalle de "azúcar cristalizada")
        const vf = voronoi2D((x / W) * VORONOI_FINE, (y / H) * VORONOI_FINE);
        const fineRise = 1 - smoothstep(0.0, 0.32, vf.f1);
        const fineValley = 1 - smoothstep(0.0, 0.05, vf.f2 - vf.f1);
        h += fineRise * 14 - fineValley * 10;

        // Detalle fino FBM para que la superficie no parezca cera
        const fine = fbm2D((x / W) * 130, (y / H) * 130, 3);
        h += (fine - 0.5) * 26;
      } else if (dist < PRECRUST_END) {
        // Pre-corteza fibrosa — fibras radiales finas y muy marcadas
        const angle = Math.atan2(dyN, dxN);
        const fibers = fbm2D(angle * 88, dist * 90, 3);
        const fibers2 = valueNoise2D(angle * 160, dist * 32);
        h = 118 + (fibers - 0.5) * 78 + (fibers2 - 0.5) * 46;
      }

      const v = Math.max(15, Math.min(240, h));
      data[i + 0] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function makeWatermelonFleshNormalTexture() {
  // 1024² mantiene los bordes Voronoi nítidos sin coste extra.
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  paintWatermelonFleshHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.6);
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
  const VORONOI_FINE = 70;
  const FLESH_END = 0.91;
  const PRECRUST_END = 0.96;

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
        rough = 0.55 - cellWet * 0.42 + borderDry * 0.20;
        // Capa fina: micro-vesículas brillantes
        const vf = voronoi2D((x / W) * VORONOI_FINE, (y / H) * VORONOI_FINE);
        const fineWet = 1 - smoothstep(0.0, 0.30, vf.f1);
        rough -= fineWet * 0.18;
        // Variación FBM fina (algunas zonas más jugosas que otras)
        rough += (fbm2D((x / W) * 90, (y / H) * 90, 3) - 0.5) * 0.10;
      } else if (dist < PRECRUST_END) {
        // Pre-corteza: bastante mate, con micro-variación
        const fiber = fbm2D((x / W) * 80, (y / H) * 80, 3);
        rough = 0.86 + (fiber - 0.5) * 0.10;
      } else {
        rough = 0.78;
      }

      // Bias adicional cerca del centro: el corazón es ligeramente
      // más brillante (más maduro = más agua libre)
      if (dist < 0.4) rough -= (0.4 - dist) * 0.10;

      rough = Math.max(0.08, Math.min(0.95, rough));
      const r255 = (rough * 255) | 0;
      data[i + 0] = r255;
      data[i + 1] = r255;
      data[i + 2] = r255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Gotitas brillantes adicionales (mismo seed-look que el color)
  for (let i = 0; i < 1100; i++) {
    const a = Math.random() * Math.PI * 2;
    const rt = Math.pow(Math.random(), 0.55) * maxR * FLESH_END;
    const x = cx + Math.cos(a) * rt;
    const y = cy + Math.sin(a) * rt;
    const sz = 1 + Math.random() * 2.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, sz);
    g.addColorStop(0, 'rgba(10,10,10,0.88)');
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
// FRIJOL — Roughness map de la vaina (PBR microfaceta)
//
// Anti-patrón fijo: hoy el cuerpo entero usa roughness=0.38 uniforme.
// La vaina real:
//   - Sutura dorsal y ventral: tejido fibroso seco (roughness ~0.65)
//   - Lóbulos seminales: cera fresca, más pulidos (roughness ~0.30)
//   - Surcos longitudinales entre semillas: ligeramente más mates
//   - Extremos (cáliz / estilo): secos
// La integración GGX da highlights "respiradores" — entran y salen al
// rotar la vaina, justo como en un pod caupí fotografiado en luz natural.
// =====================================================
export function makePodRoughnessTexture() {
  const W = 1024, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base pulida (lámina expuesta al sol con wax fresco)
  ctx.fillStyle = '#7b7b7b';  // ~0.30 roughness con material.roughness=1
  ctx.fillRect(0, 0, W, H);

  // FBM macro/micro
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const macro = fbm2D(x / W * 4, y / H * 6, 4);
      const micro = fbm2D(x / W * 22, y / H * 22, 3);
      const i = (y * W + x) * 4;
      const v = 100 + (macro - 0.5) * 60 + (micro - 0.5) * 22;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Banda sutura dorsal y ventral (top y bottom de la textura, más mates)
  const sutTop = ctx.createLinearGradient(0, 0, 0, H * 0.18);
  sutTop.addColorStop(0, 'rgba(170, 170, 170, 0.55)');
  sutTop.addColorStop(1, 'rgba(170, 170, 170, 0)');
  ctx.fillStyle = sutTop;
  ctx.fillRect(0, 0, W, H * 0.18);

  const sutBot = ctx.createLinearGradient(0, H * 0.82, 0, H);
  sutBot.addColorStop(0, 'rgba(170, 170, 170, 0)');
  sutBot.addColorStop(1, 'rgba(170, 170, 170, 0.55)');
  ctx.fillStyle = sutBot;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);

  // Surcos entre lóbulos seminales (más oscuros = más mates en su sombra)
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const cx = W * (0.1 + t * 0.8);
    const g = ctx.createRadialGradient(cx, H / 2, 0, cx, H / 2, W * 0.06);
    g.addColorStop(0, 'rgba(150, 150, 150, 0.28)');
    g.addColorStop(1, 'rgba(150, 150, 150, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, H / 2, W * 0.06, H * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Extremos: cáliz y estilo (más secos, más mates)
  const endGrad = ctx.createLinearGradient(0, 0, W, 0);
  endGrad.addColorStop(0, 'rgba(195, 195, 195, 0.55)');
  endGrad.addColorStop(0.08, 'rgba(195, 195, 195, 0)');
  endGrad.addColorStop(0.92, 'rgba(195, 195, 195, 0)');
  endGrad.addColorStop(1, 'rgba(195, 195, 195, 0.55)');
  ctx.fillStyle = endGrad;
  ctx.fillRect(0, 0, W, H);

  return toLinearTexture(canvas);
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
// FRIJOL — Roughness map de la semilla (PBR microfaceta)
//
// Anti-patrón: hoy `roughness={0.34}` uniforme. El cuerpo de un caupí
// seco es brillante (testa cerosa pulida ≈ 0.22) mientras el hilum
// (mancha negra, tejido cicatrizado) es MUY mate (≈ 0.85). Un anillo
// de transición intermedio rodea el hilum. Sin este map, el GGX
// genera un highlight uniforme = look "frijol-de-juguete-plástico".
//
// Alineamiento UV: el cylindrical UV del modelo coloca el hilum en
// u=0.5, v=0.5 (mismo offset que la color/normal texture existentes).
// =====================================================
export function makeBeanSeedRoughnessTexture() {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Cuerpo pulido (testa con cera fresca)
  ctx.fillStyle = '#3e3e3e';  // ~0.24 roughness
  ctx.fillRect(0, 0, W, H);

  // FBM micro-variation: imperfecciones de la testa
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const macro = fbm2D(x / W * 5, y / H * 5, 4);
      const micro = fbm2D(x / W * 30, y / H * 30, 3);
      const i = (y * W + x) * 4;
      const v = 70 + (macro - 0.5) * 40 + (micro - 0.5) * 22;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Hilum: parche elíptico MATE (tejido cicatrizado, sin cera)
  const hCx = W * 0.5;
  const hCy = H * 0.5;
  const hilGrad = ctx.createRadialGradient(hCx, hCy, 0, hCx, hCy, W * 0.13);
  hilGrad.addColorStop(0, 'rgba(220, 220, 220, 0.95)');  // ~0.85 roughness
  hilGrad.addColorStop(0.6, 'rgba(190, 190, 190, 0.55)');
  hilGrad.addColorStop(1, 'rgba(180, 180, 180, 0)');
  ctx.fillStyle = hilGrad;
  ctx.beginPath();
  ctx.ellipse(hCx, hCy, W * 0.13, H * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Manchitas mate dispersas (puntos de polvo / micro-imperfecciones).
  // Sin estos puntos, el highlight reflejado es demasiado continuo y
  // delata el ojo CAD.
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = `rgba(180, 180, 180, ${0.25 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return toLinearTexture(canvas);
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
// HOJA — Roughness map (PBR microfaceta)
//
// Anti-patrón: hoja con roughness uniforme = reflejo plano del entorno
// = look "papel celofán". La lámina foliar real tiene una capa cuticular
// cerosa muy pulida (roughness ~0.40 en lámina sana), mientras que las
// venas son tejido vascular sin cera (más mate, ~0.62). FBM micro añade
// la ruptura del highlight característica de hoja viva.
// =====================================================
export function makeLeafRoughnessTexture() {
  const W = 512, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Lámina pulida (cera epicuticular fresca)
  ctx.fillStyle = '#6e6e6e';  // ~0.43 roughness
  ctx.fillRect(0, 0, W, H);

  // FBM macro: parches con más/menos cera
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const macro = fbm2D(x / W * 5, y / H * 7, 4);
      const i = (y * W + x) * 4;
      const v = 110 + (macro - 0.5) * 40;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Vena central — claramente más mate
  ctx.strokeStyle = 'rgba(195, 195, 195, 0.78)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Venas secundarias
  ctx.strokeStyle = 'rgba(165, 165, 165, 0.55)';
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
  return toLinearTexture(canvas);
}

// =====================================================
// HUSK (hoja de maíz)
// =====================================================

function paintHuskColor(ctx, W, H) {
  // Gradiente vertical de bráctea madura: la base (junto al pedicelo)
  // es VERDE FRESCO (donde sigue viva la hoja); el medio es verde-amarillo
  // (transición de clorofila a senescencia); la punta es TAN/PAJA seca.
  // Coordenada vertical: y=0 = PUNTA (paja seca), y=H = BASE (verde).
  // Esta orientación replica una hoja real de elote en mercado, con la
  // punta seca como "pelillos" y la base aún verde donde abraza el olote.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d4c089');     // punta seca (paja tostada)
  grad.addColorStop(0.18, '#bdb574');  // transición seca-amarillenta
  grad.addColorStop(0.42, '#9eb551');  // amarillo-verde (senescencia)
  grad.addColorStop(0.70, '#84a833');  // verde maduro
  grad.addColorStop(0.92, '#5e8a1f');  // verde fresco base
  grad.addColorStop(1, '#446b1d');     // verde oscuro (anclaje al pedicelo)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // FBM para variación cromática orgánica (manchas claras / oscuras)
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm2D(x / W * 6, y / H * 6, 5);
      const i = (y * W + x) * 4;
      const f = 0.85 + n * 0.30;
      img.data[i + 0] = Math.min(255, img.data[i + 0] * f);
      img.data[i + 1] = Math.min(255, img.data[i + 1] * (0.90 + n * 0.25));
      img.data[i + 2] = Math.min(255, img.data[i + 2] * (0.80 + n * 0.40));
    }
  }
  ctx.putImageData(img, 0, 0);

  // VENAS LONGITUDINALES MÚLTIPLES — el rasgo más visible de la bráctea.
  // Antes 40 venas con stroke fino → resultado plano. Ahora 96 venas
  // distribuidas en tres tipos:
  //   • Mayor (cada 12): contrastada, ancha — define los pliegues
  //     principales del acanalado de la hoja
  //   • Media (cada 4): fina, marcada — refuerza las nervaduras
  //   • Menor (resto): trazo suave — agrega densidad sin saturar
  const VEIN_COUNT = 96;
  for (let i = 0; i < VEIN_COUNT; i++) {
    const x = ((i + 0.5) / VEIN_COUNT) * W;
    const isMajor = i % 12 === 0;
    const isMid = !isMajor && i % 4 === 0;
    const alphaBase = isMajor ? 0.40 : isMid ? 0.26 : 0.12;
    const alpha = alphaBase + Math.random() * 0.14;
    const widthLine = isMajor
      ? 1.4 + Math.random() * 0.9
      : isMid
        ? 0.7 + Math.random() * 0.4
        : 0.35 + Math.random() * 0.3;
    // Color más oscuro abajo (verde), más cobrizo arriba (seco)
    const veinDark = isMajor ? '20, 38, 6' : '38, 60, 14';
    ctx.strokeStyle = `rgba(${veinDark}, ${alpha})`;
    ctx.lineWidth = widthLine;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 14) {
      // Ligeras curvas para que las venas no sean perfectamente rectas
      ctx.lineTo(x + Math.sin(y * 0.018 + i * 0.41) * 1.4, y);
    }
    ctx.stroke();
  }

  // Highlights claros entre venas mayores — son los "lomos" del acanalado
  // que reciben más luz. Pintamos líneas claras en los huecos.
  for (let i = 0; i < VEIN_COUNT; i++) {
    if (i % 12 !== 6) continue; // sólo en el "valle" entre venas mayores
    const x = ((i + 0.5) / VEIN_COUNT) * W;
    ctx.strokeStyle = `rgba(255, 245, 200, ${0.12 + Math.random() * 0.10})`;
    ctx.lineWidth = 1.4 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 16) {
      ctx.lineTo(x + Math.sin(y * 0.015 + i * 0.23) * 1.2, y);
    }
    ctx.stroke();
  }

  // Marcas de senescencia: pequeñas manchas oscuras donde el verde se
  // está secando. Más densas en la mitad superior (zona de transición).
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    const yt = Math.pow(Math.random(), 1.6); // sesgo hacia arriba
    const y = yt * H * 0.55;
    const r = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(85, 70, 28, ${0.20 + Math.random() * 0.20})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Manchas de sol / pulido — highlights cálidos sobre toda la hoja
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 5 + Math.random() * 22;
    ctx.fillStyle = `rgba(245, 230, 180, ${0.04 + Math.random() * 0.09})`;
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
  // Base media — las venas (más claras) y los surcos (más oscuros)
  // se pintan encima como modulación de altura.
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, W, H);

  // Acanalado dominante: 48 surcos paralelos. En lugar de pintar líneas
  // sueltas, generamos directamente un patrón sinusoidal pixel-a-pixel
  // que produce CRESTAS Y VALLES alternados. Esto da al normal map una
  // estructura periódica que las luces direccionales convierten en el
  // brillo acanalado característico de la bráctea.
  const RIDGE_COUNT = 48;
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xRel = x / W;
      // Onda principal: surcos paralelos
      const ridge = Math.cos(xRel * Math.PI * 2 * RIDGE_COUNT);
      // FBM sutil para que el acanalado no sea perfectamente uniforme
      const noiseHi = (fbm2D(x / W * 14, y / H * 28, 3) - 0.5) * 0.35;
      // Pequeñas roturas (rasgaduras) en el sentido vertical
      const tear = (fbm2D(x / W * 3, y / H * 32, 2) - 0.5) * 0.15;
      // Altura final, 0..1
      const h = 0.50 + ridge * 0.32 + noiseHi * 0.18 + tear * 0.18;
      const v = Math.max(0, Math.min(255, h * 255));
      const i = (y * W + x) * 4;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Venas mayores — destacadas como crestas más altas (cada 12 columnas)
  for (let i = 0; i < RIDGE_COUNT; i += 4) {
    const x = (i / RIDGE_COUNT) * W;
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 16) {
      ctx.lineTo(x + Math.sin(y * 0.018 + i * 0.41) * 1.4, y);
    }
    ctx.stroke();
  }

  // Ruido fino para granularidad de fibra
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 100 + Math.random() * 110;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + Math.random() * 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makeHuskNormalTexture() {
  const W = 512, H = 2048;
  const canvas = makeCanvas(W, H);
  paintHuskHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 2.2);
}

// Alpha map de la hoja envolvente: blanco en el interior, recortes
// irregulares en bordes laterales y punta superior. Se aplica con
// alphaTest=0.5 para que las hojas pierdan la silueta de rectángulo y
// adopten contornos rasgados como las brácteas reales secas.
export function makeHuskAlphaTexture() {
  const W = 512, H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    // Borde lateral: noise FBM modula el ancho efectivo
    const yt = y / H;
    const leftNoise = fbm2D(yt * 18, 0, 4);
    const rightNoise = fbm2D(yt * 18, 100, 4);
    // Tip rasgado: por encima de yt=0.88 introducimos mucho más recorte
    const tipFade = yt > 0.88 ? Math.pow((yt - 0.88) / 0.12, 1.4) : 0;
    const leftCut = leftNoise * 0.06 + tipFade * 0.45;
    const rightCut = rightNoise * 0.06 + tipFade * 0.45;

    for (let x = 0; x < W; x++) {
      const xt = x / W;
      let a = 1.0;
      if (xt < leftCut || xt > 1 - rightCut) a = 0.0;
      // Pequeñas mordeduras random a media hoja (rasgaduras internas)
      if (yt > 0.55) {
        const tear = fbm2D(xt * 22, yt * 12, 3);
        if (tear > 0.78 && (xt < 0.15 || xt > 0.85)) a = 0.0;
      }
      const i = (y * W + x) * 4;
      const v = (a * 255) | 0;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toLinearTexture(canvas);
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

// =====================================================
// MAÍZ — Texturas PBR para superficie individual del grano
//
// Los granos del CornModel se renderizan via InstancedMesh sobre una
// SphereGeometry deformada; cada instancia comparte la misma malla y
// las mismas UV (esféricas, u=longitud 0..1 envolviendo el grano,
// v=latitud 0..1 del germen al ápice). Por eso un solo set de mapas
// pequeños (256×256) basta — la variación per-grano se obtiene con
// instanceColor + instanceRoughness (shader injection).
//
// Justificación física: un grano de maíz fresco tiene una "pelícuda"
// (testa/pericarp) cerosa muy fina sobre el endospermo. La microfaceta
// de esa pelícuda no es uniforme: pequeñas gotas de humedad, polvo
// agrícola, y la propia rugosidad submilimétrica del tejido producen
// una distribución de rugosidad que en cualquier fotografía cercana
// se traduce en highlights ROTOS, no en un highlight especular limpio.
// Eso es lo que distingue al "render PBR de juguete" del "fresco".
// =====================================================

export function makeKernelRoughnessTexture() {
  // Map de roughness sub-grano: FBM de 4 octavas con dos escalas (macro
  // y micro) sumadas. Salida en rango [0.42, 0.88] — abajo del rango
  // damos zonas "pulidas" (sueltan highlight), arriba zonas "secas".
  // Ambos extremos clamped para no producir spots espejo ni puntos
  // perfectamente lambertianos.
  const W = 256, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Macro: variación a escala grano (~3 "ciclos" por kernel)
      const macro = fbm2D(x / W * 4, y / H * 4, 4);
      // Micro: polvo/humedad puntiforme (~12 ciclos)
      const micro = fbm2D(x / W * 18, y / H * 18, 3);
      // Dent shadow: la zona inferior central tiene tejido más húmedo
      // (cerca del germen), tiende a ser menos roughness por la humedad
      // residual. Banda gaussiana centrada en u=0.5, v=0.18.
      const du = (x / W) - 0.5;
      const dv = (y / H) - 0.18;
      const germBand = Math.exp(-(du * du * 18 + dv * dv * 28)) * 0.18;
      // Combina: base 0.6, modulada por macro ±0.18, micro ±0.10, germ -0.18
      const r = 0.62 + (macro - 0.5) * 0.36 + (micro - 0.5) * 0.20 - germBand;
      const clamped = Math.max(0.35, Math.min(0.92, r));
      const v = (clamped * 255) | 0;
      const i = (y * W + x) * 4;
      img.data[i + 0] = v;  // R: ocluido para AO si se usa después
      img.data[i + 1] = v;  // G: el canal que MeshPhysicalMaterial lee como roughness
      img.data[i + 2] = v;  // B: el canal que se lee como metalness (mantener constante)
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toLinearTexture(canvas);
}

export function makeKernelNormalTexture() {
  // Micro-normal: papilas y poros submilimétricos en la pelícuda del
  // grano. Strength baja (0.5) — el detalle aquí NO debe competir con
  // la silueta del kernel; sólo romper el highlight especular para que
  // el ojo NO perciba la superficie como una bola perfecta de plástico.
  // Combinamos value-noise multi-octava con voronoi (poros) sumados
  // como modulación de altura.
  const W = 256, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fine = fbm2D(x / W * 24, y / H * 24, 4);
      const pores = voronoi2D(x / W * 20, y / H * 20);
      // Combina: base 0.5, fine ±0.30, pores invertidos ±0.20
      const h = 0.50 + (fine - 0.5) * 0.50 + (1 - pores) * 0.18;
      const v = Math.max(0, Math.min(255, (h * 255) | 0));
      const i = (y * W + x) * 4;
      img.data[i + 0] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return normalTextureFromHeightCanvas(canvas, 0.45);
}

// =====================================================
// COB CORE (olote desnudo)
//
// El olote es tejido lignificado/cellulósico SECO. Es esencialmente
// fibra paralela al eje longitudinal con huecos donde se anclan los
// granos. Físicamente: muy rough (microfacetas dispersas), sin cera,
// sin cuticula reflectiva. Roughness map enfatiza la fibras verticales.
// =====================================================

export function makeCobCoreRoughnessTexture() {
  // El olote se mapea con LatheGeometry: UV.u envuelve el cilindro
  // (0..1 alrededor del eje), UV.v sube por el eje. Las fibras van
  // a lo largo de v → modulación con cos(u·N) y suave FBM en v.
  const W = 256, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // Fibras: ~60 a lo largo del perímetro
      const fiber = Math.cos(u * Math.PI * 2 * 60 + fbm2D(u * 4, v * 12, 2) * 6);
      // Variación longitudinal (huecos de granos arrancados)
      const macro = fbm2D(u * 8, v * 16, 4);
      // Roughness 0.78..0.96 — siempre alto (olote es muy mate)
      const r = 0.86 + (macro - 0.5) * 0.16 + fiber * 0.04;
      const clamped = Math.max(0.74, Math.min(0.98, r));
      const val = (clamped * 255) | 0;
      const i = (y * W + x) * 4;
      img.data[i + 0] = val;
      img.data[i + 1] = val;
      img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toLinearTexture(canvas);
}

export function makeCobCoreNormalTexture() {
  // Normal del olote: fibras paralelas al eje longitudinal + leve
  // craqueado del tejido. Strength moderada (0.7) — el detalle se ve
  // sólo entre filas de granos, pero le da carácter de cellulose seco.
  const W = 256, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // Surcos verticales (entre fibras)
      const fiber = Math.cos(u * Math.PI * 2 * 70) * 0.5 + 0.5;
      // Variación pixel-fine: irregularidades del tejido
      const grain = fbm2D(u * 32, v * 24, 3);
      const h = 0.50 + fiber * 0.18 + (grain - 0.5) * 0.30;
      const val = Math.max(0, Math.min(255, (h * 255) | 0));
      const i = (y * W + x) * 4;
      img.data[i + 0] = val;
      img.data[i + 1] = val;
      img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return normalTextureFromHeightCanvas(canvas, 0.85);
}
