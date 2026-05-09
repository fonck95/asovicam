import * as THREE from 'three';

// =====================================================
// Texturas procedurales generadas en <canvas> 2D.
// Reemplaza los shaders inyectados (onBeforeCompile) por
// algo determinista, fácil de entender y libre de bugs
// de compilación entre versiones de three.js.
// =====================================================

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas, { repeat = [1, 1] } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function toBumpTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ---------- CORN ----------

// Color map: kernels in a staggered grid with subtle color variation.
export function makeCornColorTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, 0, W, H);

  const COLS = 22;
  const ROWS = 26;
  const cellW = W / COLS;
  const cellH = H / ROWS;

  const palette = ['#fcd34d', '#fbbf24', '#f59e0b', '#fde68a', '#facc15', '#eab308'];

  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const rawSeed = (row * 31 + col * 17) % palette.length;
      const seed = (rawSeed + palette.length) % palette.length;
      const baseColor = palette[seed];

      // Highlight gradient on each kernel
      const grad = ctx.createRadialGradient(
        cx - cellW * 0.18,
        cy - cellH * 0.22,
        0,
        cx,
        cy,
        cellW * 0.55,
      );
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(0.35, baseColor);
      grad.addColorStop(1, '#a16207');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle shadow seam between kernels
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  return toTexture(canvas);
}

// Bump map: bright in kernel center, dark in seams (gives 3D relief
// without expensive geometry).
export function makeCornBumpTexture() {
  const W = 1024;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, W, H);

  const COLS = 22;
  const ROWS = 26;
  const cellW = W / COLS;
  const cellH = H / ROWS;

  for (let row = 0; row < ROWS; row++) {
    const stagger = (row % 2) * (cellW / 2);
    for (let col = -1; col <= COLS; col++) {
      const cx = col * cellW + stagger + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellW * 0.55);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#bdbdbd');
      grad.addColorStop(1, '#202020');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * 0.46, cellH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return toBumpTexture(canvas);
}

// ---------- WATERMELON ----------

export function makeWatermelonColorTexture() {
  const W = 2048;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Light green base
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#4d7c0f');
  base.addColorStop(0.5, '#65a30d');
  base.addColorStop(1, '#4d7c0f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Pale green mottling on the light bands
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 6 + Math.random() * 18;
    ctx.fillStyle = `rgba(190, 230, 130, ${0.05 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark stripes — wavy bands across the cylinder unwrap.
  const STRIPES = 11;
  const stripeWidth = W / STRIPES;
  for (let s = 0; s < STRIPES; s++) {
    const cx = s * stripeWidth + stripeWidth / 2;
    ctx.save();
    ctx.beginPath();
    // Wavy stripe path
    const segments = 60;
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
    grad.addColorStop(0, '#0c2d12');
    grad.addColorStop(0.5, '#1a3d1a');
    grad.addColorStop(1, '#0c2d12');
    ctx.fillStyle = grad;
    ctx.fill();

    // Mottling inside dark stripes
    ctx.clip();
    for (let i = 0; i < 80; i++) {
      const x = cx - stripeWidth * 0.5 + Math.random() * stripeWidth;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(80, 120, 50, ${0.08 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return toTexture(canvas);
}

// Bump for watermelon: subtle relief along the stripes
export function makeWatermelonBumpTexture() {
  const W = 1024;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, W, H);

  // Soft pebbly noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 3;
    const v = 100 + Math.random() * 110;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return toBumpTexture(canvas);
}

// ---------- BEAN POD / LEAF ----------

export function makePodColorTexture() {
  const W = 1024;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Vertical gradient simulating curve shading on the pod
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3f6212');
  grad.addColorStop(0.5, '#84cc16');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle longitudinal striations
  for (let i = 0; i < 60; i++) {
    const y = (i / 60) * H + Math.random() * 4;
    ctx.strokeStyle = `rgba(56, 90, 16, ${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 30) {
      ctx.lineTo(x, y + Math.sin(x * 0.04) * 1.6);
    }
    ctx.stroke();
  }

  // Tip and base darkening (handled in the shape too, but reinforcing here)
  const ends = ctx.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(20, 50, 10, 0.55)');
  ends.addColorStop(0.08, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(0.92, 'rgba(20, 50, 10, 0.0)');
  ends.addColorStop(1, 'rgba(20, 50, 10, 0.55)');
  ctx.fillStyle = ends;
  ctx.fillRect(0, 0, W, H);

  return toTexture(canvas);
}

export function makeLeafColorTexture() {
  const W = 512;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Base leaf gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#365314');
  grad.addColorStop(0.5, '#4d7c0f');
  grad.addColorStop(1, '#1a2e05');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Central vein
  ctx.strokeStyle = 'rgba(20, 50, 10, 0.7)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Side veins
  ctx.strokeStyle = 'rgba(20, 50, 10, 0.45)';
  ctx.lineWidth = 1.6;
  for (let i = 1; i < 14; i++) {
    const y = (i / 14) * H;
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

  // Soft highlights
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = `rgba(180, 220, 120, ${0.04 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTexture(canvas);
}

// ---------- HUSK (corn leaf) ----------

export function makeHuskColorTexture() {
  const W = 256;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#a3a380');
  grad.addColorStop(0.4, '#84cc16');
  grad.addColorStop(0.85, '#65a30d');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Vertical veins typical of corn husks
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * W;
    ctx.strokeStyle = `rgba(40, 70, 10, ${0.18 + Math.random() * 0.18})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= H; y += 20) {
      ctx.lineTo(x + Math.sin(y * 0.02) * 1.6, y);
    }
    ctx.stroke();
  }

  return toTexture(canvas);
}
