import * as THREE from 'three';

// =====================================================
// Texturas procedurales generadas en <canvas> 2D.
//
// Cada superficie obtiene hasta 3 mapas:
//   - color  (sRGB, base albedo)
//   - normal (linear, calculado vía Sobel desde un height map)
//   - rough  (linear, controla brillo localmente)
//
// El normal map se deriva matemáticamente del height map para
// evitar shaders custom — es totalmente determinista y le da
// al material relieve fotorrealista bajo luz dinámica.
// =====================================================

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toColorTexture(canvas, { repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function toLinearTexture(canvas, { repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Worley/cellular noise (grid-based F1, F2) ----------
//
// Genera una malla de "células" tipo Worley: para cada pixel calcula
// la distancia F1 al punto más cercano (cell-center) y F2 al segundo
// más cercano (cell-edge). Wrap-around para que la textura sea tiled.
//
// Devuelve dos Float32Array (f1, f2) en rango [0..gridSize] aprox.

function generateWorleyField(W, H, cellSize) {
  const cellsX = Math.ceil(W / cellSize);
  const cellsY = Math.ceil(H / cellSize);
  // Grid de seeds (uno por celda)
  const seeds = new Float32Array(cellsX * cellsY * 2);
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const idx = (cy * cellsX + cx) * 2;
      seeds[idx + 0] = cx * cellSize + Math.random() * cellSize;
      seeds[idx + 1] = cy * cellSize + Math.random() * cellSize;
    }
  }
  const f1 = new Float32Array(W * H);
  const f2 = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const cy = Math.floor(y / cellSize);
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(x / cellSize);
      let m1 = Infinity, m2 = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ((cx + dx) % cellsX + cellsX) % cellsX;
          const ny = ((cy + dy) % cellsY + cellsY) % cellsY;
          const idx = (ny * cellsX + nx) * 2;
          let sx = seeds[idx + 0];
          let sy = seeds[idx + 1];
          // Compensar wrap (sumar/restar W o H si la celda quedó del otro lado)
          if (cx + dx < 0) sx -= W;
          else if (cx + dx >= cellsX) sx += W;
          if (cy + dy < 0) sy -= H;
          else if (cy + dy >= cellsY) sy += H;
          const dxx = x - sx, dyy = y - sy;
          const d = Math.sqrt(dxx * dxx + dyy * dyy);
          if (d < m1) { m2 = m1; m1 = d; }
          else if (d < m2) { m2 = d; }
        }
      }
      const i = y * W + x;
      f1[i] = m1;
      f2[i] = m2;
    }
  }
  return { f1, f2, cellSize };
}

// ---------- value noise (suave, multi-octava) ----------

function makeValueNoise2D(seed = 1) {
  // Hashing simple para value noise (no Perlin perfect, pero decente).
  const random = (() => {
    let s = seed * 9301 + 49297;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  })();
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  const at = (ix, iy) => grid[((iy % SIZE) + SIZE) % SIZE * SIZE + ((ix % SIZE) + SIZE) % SIZE];
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = at(ix, iy), b = at(ix + 1, iy);
    const c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    const u = fade(fx), v = fade(fy);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}

function fbm2D(noise, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 0.5, freq = 1.0, sum = 0.0, norm = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
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

  // Wrap-around sampling so tiled materials no tienen costuras.
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

// =====================================================
// MAÍZ
// =====================================================

function paintCornKernels(ctx, W, H) {
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, 0, W, H);

  const COLS = 22;
  const ROWS = 28;
  const cellW = W / COLS;
  const cellH = H / ROWS;
  const palette = ['#fcd34d', '#fbbf24', '#f59e0b', '#fde68a', '#facc15', '#eab308', '#fef3c7'];

  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const seed = (((row * 31 + col * 17) % palette.length) + palette.length) % palette.length;
      const baseColor = palette[seed];

      // Granos: gradiente con highlight superior (lustre fresco)
      const grad = ctx.createRadialGradient(
        cx - cellW * 0.18,
        cy - cellH * 0.22,
        0,
        cx,
        cy,
        cellW * 0.55,
      );
      grad.addColorStop(0, '#fffdf2');
      grad.addColorStop(0.32, baseColor);
      grad.addColorStop(0.85, '#b45309');
      grad.addColorStop(1, '#78350f');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Surco profundo entre granos
      ctx.strokeStyle = 'rgba(67, 26, 4, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Pequeño highlight especular en cada grano (gota de agua)
      ctx.fillStyle = 'rgba(255, 253, 235, 0.55)';
      ctx.beginPath();
      ctx.ellipse(
        cx - cellW * 0.16,
        cy - cellH * 0.22,
        cellW * 0.07,
        cellH * 0.05,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}

export function makeCornColorTexture() {
  const W = 1024, H = 1024;
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
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellW * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#9a9a9a');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function makeCornNormalTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  paintCornHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 2.4);
}

export function makeCornRoughnessTexture() {
  const W = 512, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  // Granos brillantes (rough bajo) sobre surcos mate (rough alto).
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(0, 0, W, H);
  const COLS = 22, ROWS = 28;
  const cellW = W / COLS, cellH = H / ROWS;
  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const grad = ctx.createRadialGradient(cx - cellW * 0.18, cy - cellH * 0.22, 0, cx, cy, cellW * 0.5);
      grad.addColorStop(0, '#1a1a1a'); // muy brillante (gota)
      grad.addColorStop(0.5, '#5e5e5e');
      grad.addColorStop(1, '#cfcfcf');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toLinearTexture(canvas);
}

// =====================================================
// SANDÍA — exterior
// =====================================================

function paintWatermelonRind(ctx, W, H) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#3f6212');
  base.addColorStop(0.5, '#65a30d');
  base.addColorStop(1, '#365314');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Moteado claro en bandas claras
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 4 + Math.random() * 18;
    ctx.fillStyle = `rgba(190, 230, 130, ${0.04 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Franjas oscuras onduladas
  const STRIPES = 11;
  const stripeWidth = W / STRIPES;
  for (let s = 0; s < STRIPES; s++) {
    const cx = s * stripeWidth + stripeWidth / 2;
    ctx.save();
    ctx.beginPath();
    const segments = 80;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * H;
      const wob =
        Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.18 +
        Math.sin(t * 21 + s) * stripeWidth * 0.06;
      const x = cx + wob - stripeWidth * 0.32;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * H;
      const wob =
        Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.18 +
        Math.sin(t * 21 + s) * stripeWidth * 0.06;
      const x = cx + wob + stripeWidth * 0.32;
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(cx - stripeWidth * 0.4, 0, cx + stripeWidth * 0.4, 0);
    grad.addColorStop(0, '#06200d');
    grad.addColorStop(0.5, '#143a18');
    grad.addColorStop(1, '#06200d');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.clip();
    for (let i = 0; i < 100; i++) {
      const x = cx - stripeWidth * 0.5 + Math.random() * stripeWidth;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(80, 120, 50, ${0.08 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Sutil cera (highlights difusos)
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 30 + Math.random() * 80;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(220, 240, 180, 0.06)');
    grad.addColorStop(1, 'rgba(220, 240, 180, 0)');
    ctx.fillStyle = grad;
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
      const wob = Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.18;
      const x = cx + wob - stripeWidth * 0.32;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * H;
      const wob = Math.sin(t * 9 + s * 1.3) * stripeWidth * 0.18;
      const x = cx + wob + stripeWidth * 0.32;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#bababa';
    ctx.fill();
    ctx.restore();
  }

  // Ruido pebbly
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 3;
    const v = 110 + Math.random() * 90;
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
  return normalTextureFromHeightCanvas(canvas, 1.6);
}

// =====================================================
// SANDÍA — pulpa interior fotorrealista
//
// Capa 1: gradiente radial complejo (rojo profundo → rosa
//         → blanco corteza → halo verde).
// Capa 2: células Worley (F2-F1) que dan el patrón celular
//         vivo de la pulpa, modulado por fbm para que no
//         parezca regular.
// Capa 3: red vascular ramificada que sale del corazón
//         con subramas (algoritmo recursivo).
// Capa 4: marcas de corte horizontales (cuchillo).
// Capa 5: gotitas de jugo (highlights especulares).
// Capa 6: aro blanco-verde de la corteza.
// =====================================================

const WM_FLESH_W = 1024;
const WM_FLESH_H = 1024;

// Distancia normalizada al centro [0..1]
function radialT(x, y, W, H) {
  const dx = x - W / 2;
  const dy = y - H / 2;
  return Math.sqrt(dx * dx + dy * dy) / (W * 0.5);
}

function lerpHex(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16);
  const b = parseInt(c2.slice(1), 16);
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return [r, g, bl];
}

function fleshColorAt(t, cellEdge, fbmVal) {
  // t ∈ [0..1] desde el centro
  // Curva de gradiente con stops realistas
  let r, g, b;
  if (t < 0.18) {
    [r, g, b] = lerpHex('#a30b1e', '#dc2626', t / 0.18);
  } else if (t < 0.45) {
    [r, g, b] = lerpHex('#dc2626', '#f87171', (t - 0.18) / 0.27);
  } else if (t < 0.7) {
    [r, g, b] = lerpHex('#f87171', '#fda4af', (t - 0.45) / 0.25);
  } else if (t < 0.86) {
    [r, g, b] = lerpHex('#fda4af', '#fef2f2', (t - 0.7) / 0.16);
  } else if (t < 0.93) {
    [r, g, b] = lerpHex('#fef2f2', '#f5f5f4', (t - 0.86) / 0.07);
  } else {
    [r, g, b] = lerpHex('#bbf7d0', '#65a30d', (t - 0.93) / 0.07);
  }
  // Modular con celularidad: bordes de células ligeramente más oscuros
  const cellMod = 1 - cellEdge * 0.18;
  // Y con fbm para evitar regularidad
  const noiseMod = 0.92 + fbmVal * 0.16;
  r = Math.max(0, Math.min(255, r * cellMod * noiseMod));
  g = Math.max(0, Math.min(255, g * cellMod * noiseMod));
  b = Math.max(0, Math.min(255, b * cellMod * noiseMod));
  return [r, g, b];
}

function paintWatermelonFlesh(ctx, W, H) {
  // Field celular F1, F2 — F2-F1 es el patrón de bordes de célula
  const { f1, f2, cellSize } = generateWorleyField(W, H, 28);
  const noise = makeValueNoise2D(7);
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = radialT(x, y, W, H);
      // Edge factor: alto en bordes de células, bajo en centros
      const cellEdge = Math.max(0, Math.min(1, (cellSize - (f2[i] - f1[i])) / cellSize));
      // En el centro del melón las células son más grandes/menos visibles
      const cellWeight = Math.min(1, t * 1.3);
      const cellEdgeWeighted = cellEdge * cellWeight;
      const fbmVal = fbm2D(noise, x / 60, y / 60, 4);
      const [r, g, b] = fleshColorAt(t, cellEdgeWeighted, fbmVal);
      const idx = i * 4;
      img.data[idx + 0] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ---- Red vascular ramificada (vasos del placentar) ----
  ctx.save();
  ctx.translate(W / 2, H / 2);
  drawVascularBranches(ctx, W);
  ctx.restore();

  // ---- Marcas finas del corte (cuchillo) ----
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * H;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.3, 'rgba(255,240,240,0.18)');
    grad.addColorStop(0.7, 'rgba(255,240,240,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, 0.8 + Math.random() * 1.6);
  }
  ctx.restore();

  // ---- Gotitas de jugo (highlights) ----
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const t = radialT(x, y, W, H);
    if (t > 0.85) continue;
    const a = (1 - t) * (0.18 + Math.random() * 0.32);
    const r = 0.4 + Math.random() * 1.4;
    ctx.fillStyle = `rgba(255, 250, 245, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Pequeñas vetas finas blanquecinas en zona del corazón ----
  ctx.save();
  ctx.translate(W / 2, H / 2);
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const r1 = Math.random() * W * 0.05;
    const r2 = r1 + 4 + Math.random() * 18;
    ctx.strokeStyle = `rgba(255, 240, 240, ${0.18 + Math.random() * 0.22})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

// Red vascular — algoritmo recursivo de ramas con sub-ramas
function drawVascularBranches(ctx, W) {
  const branches = 14;
  const innerRadius = W * 0.04;
  const outerRadius = W * 0.42;
  for (let i = 0; i < branches; i++) {
    const baseAngle = (i / branches) * Math.PI * 2 + Math.random() * 0.18;
    drawBranch(ctx, 0, 0, baseAngle, outerRadius, 1.3, 0);
    // Pequeñas vetas adicionales que arrancan desde el corazón
    if (i % 2 === 0) {
      const a2 = baseAngle + 0.15;
      drawBranch(ctx, Math.cos(a2) * innerRadius, Math.sin(a2) * innerRadius, a2 + 0.3, outerRadius * 0.7, 0.9, 0);
    }
  }
}

function drawBranch(ctx, x0, y0, angle, length, width, depth) {
  if (length < 12 || depth > 3) return;
  const segments = 14;
  const points = [{ x: x0, y: y0 }];
  let cx = x0, cy = y0, ca = angle;
  for (let i = 1; i <= segments; i++) {
    const stepLen = length / segments;
    cx += Math.cos(ca) * stepLen;
    cy += Math.sin(ca) * stepLen;
    ca += (Math.random() - 0.5) * 0.22;
    points.push({ x: cx, y: cy });
  }
  // Dibujar el path con grosor decreciente
  for (let i = 1; i < points.length; i++) {
    const t = i / points.length;
    const w = width * (1 - t * 0.85);
    ctx.strokeStyle = `rgba(140, 14, 30, ${0.32 - depth * 0.1})`;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  // Sub-ramas
  if (depth < 2) {
    const branchPoints = [Math.floor(segments * 0.3), Math.floor(segments * 0.6), Math.floor(segments * 0.85)];
    for (const idx of branchPoints) {
      if (Math.random() < 0.62) {
        const p = points[idx];
        const t = idx / segments;
        const subAngle = angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
        drawBranch(ctx, p.x, p.y, subAngle, length * (0.35 - depth * 0.08) * (1 - t * 0.5), width * 0.55, depth + 1);
      }
    }
  }
}

export function makeWatermelonFleshTexture() {
  const canvas = makeCanvas(WM_FLESH_W, WM_FLESH_H);
  paintWatermelonFlesh(canvas.getContext('2d'), WM_FLESH_W, WM_FLESH_H);
  return toColorTexture(canvas);
}

// Height map de la pulpa: las células se elevan ligeramente, los bordes
// se hunden, el corazón es más profundo. Se convierte en normal map.
function paintWatermelonFleshHeight(ctx, W, H) {
  const { f1, f2, cellSize } = generateWorleyField(W, H, 28);
  const noise = makeValueNoise2D(11);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = radialT(x, y, W, H);
      // F1 normalizado: 0 en centros de célula, alto en bordes
      const center = 1 - Math.min(1, f1[i] / (cellSize * 0.6));
      // Edge: sólo activo cerca de bordes
      const edge = Math.max(0, Math.min(1, (cellSize - (f2[i] - f1[i])) / cellSize));
      // FBM para granulado fino
      const fbmVal = fbm2D(noise, x / 18, y / 18, 4);
      // Combinar: célula central elevada, borde hundido, ruido para textura
      let h = 0.55 + center * 0.35 - edge * 0.4 + (fbmVal - 0.5) * 0.18;
      // Cerca del centro la pulpa es más uniforme
      h = h * (1 - t * 0.25);
      // Cerca de la corteza más plana
      if (t > 0.85) h = 0.55 + (fbmVal - 0.5) * 0.05;
      h = Math.max(0, Math.min(1, h));
      const v = h * 255;
      const idx = i * 4;
      img.data[idx + 0] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function makeWatermelonFleshNormalTexture() {
  const W = 1024, H = 1024;
  const canvas = makeCanvas(W, H);
  paintWatermelonFleshHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.8);
}

// Roughness: bordes de células más rugosos (mate), centros pulidos (jugo)
export function makeWatermelonFleshRoughnessTexture() {
  const W = 512, H = 512;
  const { f1, f2, cellSize } = generateWorleyField(W, H, 14);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = radialT(x, y, W, H);
      const edge = Math.max(0, Math.min(1, (cellSize - (f2[i] - f1[i])) / cellSize));
      // Centros: 0.25 (brillante), bordes: 0.75 (mate)
      let r = 0.25 + edge * 0.5;
      // Cerca de la corteza más mate
      if (t > 0.86) r = Math.min(1, r + 0.2);
      const v = Math.round(r * 255);
      const idx = i * 4;
      img.data[idx + 0] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toLinearTexture(canvas);
}

// =====================================================
// FRIJOL — vaina exterior
// =====================================================

function paintPodColor(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#365314');
  grad.addColorStop(0.5, '#84cc16');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Estriado longitudinal
  for (let i = 0; i < 90; i++) {
    const y = (i / 90) * H + Math.random() * 4;
    ctx.strokeStyle = `rgba(34, 64, 12, ${0.06 + Math.random() * 0.16})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 30) {
      ctx.lineTo(x, y + Math.sin(x * 0.04) * 1.6);
    }
    ctx.stroke();
  }

  // Manchitas frescas (puntos verdes claros)
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(190, 240, 120, ${0.05 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + Math.random() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Oscurecimiento en los extremos
  const ends = ctx.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(20, 50, 10, 0.55)');
  ends.addColorStop(0.08, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(0.92, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(1, 'rgba(20, 50, 10, 0.55)');
  ctx.fillStyle = ends;
  ctx.fillRect(0, 0, W, H);
}

export function makePodColorTexture() {
  const W = 1024, H = 256;
  const canvas = makeCanvas(W, H);
  paintPodColor(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintPodHeight(ctx, W, H) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    const y = (i / 60) * H;
    ctx.strokeStyle = `rgba(${30 + Math.random() * 40},${30 + Math.random() * 40},${30 + Math.random() * 40},0.6)`;
    ctx.lineWidth = 0.4 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 25) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 1.4);
    }
    ctx.stroke();
  }
  // Pequeños bumps al azar
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 130 + Math.random() * 100;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function makePodNormalTexture() {
  const W = 1024, H = 256;
  const canvas = makeCanvas(W, H);
  paintPodHeight(canvas.getContext('2d'), W, H);
  return normalTextureFromHeightCanvas(canvas, 1.4);
}

// =====================================================
// FRIJOL — semilla (kidney bean)
// =====================================================

export function makeBeanSeedTexture() {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Color base: rojo-marrón-vino (frijol pinto/rojo)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#7c2d12');
  grad.addColorStop(0.5, '#9a3412');
  grad.addColorStop(1, '#5b1d0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Pinto: motas claras
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = `rgba(${200 + Math.random() * 50},${170 + Math.random() * 40},${130 + Math.random() * 30},${0.15 + Math.random() * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hilo (línea oscura en el medio)
  ctx.strokeStyle = 'rgba(20, 5, 0, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  for (let x = 0; x <= W; x += 12) {
    ctx.lineTo(x, H * 0.5 + Math.sin(x * 0.06) * 4);
  }
  ctx.stroke();

  // Highlight especular tenue
  const hl = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.4);
  hl.addColorStop(0, 'rgba(255, 230, 200, 0.18)');
  hl.addColorStop(1, 'rgba(255, 230, 200, 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, W, H);

  return toColorTexture(canvas);
}

// =====================================================
// HOJA verde (frijol y sandía)
// =====================================================

function paintLeafColor(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2a4f12');
  grad.addColorStop(0.5, '#4d7c0f');
  grad.addColorStop(1, '#1a2e05');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

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
  for (let i = 0; i < 250; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(180, 220, 120, ${0.04 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sutil moteado oscuro
  for (let i = 0; i < 200; i++) {
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

  // Vena central elevada (oscura = más baja, blanca = más alta)
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
  return normalTextureFromHeightCanvas(canvas, 1.2);
}

// =====================================================
// HUSK (hoja de maíz)
// =====================================================

function paintHuskColor(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#cdb380'); // punta seca/cremosa
  grad.addColorStop(0.35, '#a3a380');
  grad.addColorStop(0.65, '#84cc16');
  grad.addColorStop(0.92, '#65a30d');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Venas verticales
  for (let i = 0; i < 30; i++) {
    const x = (i / 30) * W;
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
  for (let i = 0; i < 80; i++) {
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
  const W = 256, H = 1024;
  const canvas = makeCanvas(W, H);
  paintHuskColor(canvas.getContext('2d'), W, H);
  return toColorTexture(canvas);
}

function paintHuskHeight(ctx, W, H) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    const x = (i / 30) * W;
    ctx.strokeStyle = '#dcdcdc';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 18) {
      ctx.lineTo(x + Math.sin(y * 0.02) * 1.6, y);
    }
    ctx.stroke();
  }
  // ruido fino
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const v = 110 + Math.random() * 90;
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
  return normalTextureFromHeightCanvas(canvas, 1.0);
}
