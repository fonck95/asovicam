import { useEffect, useRef } from 'react';
import { getWebGPUDevice } from '../../utils/webgpu';
import styles from './WebGPUBackdrop.module.css';

const SHADER = /* wgsl */ `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  pointer: vec2<f32>,
  intensity: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VsOut {
  // Fullscreen triangle.
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var out: VsOut;
  let v = p[vi];
  out.pos = vec4<f32>(v, 0.0, 1.0);
  out.uv = (v + vec2<f32>(1.0)) * 0.5;
  return out;
}

// Hash + value-noise + FBM — cheap organic field.
fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}
fn noise2(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i + vec2<f32>(0.0, 0.0));
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn fbm(p0: vec2<f32>) -> f32 {
  var p = p0;
  var v = 0.0;
  var amp = 0.5;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + amp * noise2(p);
    p = p * 2.02 + vec2<f32>(13.0, 7.0);
    amp = amp * 0.5;
  }
  return v;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(u.resolution.y, 1.0);
  var uv = in.uv;
  uv.x = uv.x * aspect;

  let t = u.time * 0.05;
  let p = vec2<f32>(uv.x + t * 0.6, uv.y - t * 0.4);

  // Domain-warped FBM for organic flow.
  let q = vec2<f32>(fbm(p + vec2<f32>(0.0, 0.0)), fbm(p + vec2<f32>(5.2, 1.3)));
  let r = vec2<f32>(
    fbm(p + 1.6 * q + vec2<f32>(1.7, 9.2) + 0.15 * t),
    fbm(p + 1.6 * q + vec2<f32>(8.3, 2.8) + 0.13 * t),
  );
  let f = fbm(p + 1.4 * r);

  // Brand palette: deep forest → leaf → warm honey.
  let cDeep   = vec3<f32>(0.020, 0.180, 0.086); // #052e16
  let cLeaf   = vec3<f32>(0.086, 0.396, 0.204); // #166534
  let cMid    = vec3<f32>(0.133, 0.773, 0.369); // #22c55e
  let cWarm   = vec3<f32>(0.851, 0.467, 0.024); // #d97706
  let cCream  = vec3<f32>(0.992, 0.949, 0.882); // #fdf2e2

  var col = mix(cDeep, cLeaf, smoothstep(0.10, 0.55, f));
  col = mix(col, cMid,  smoothstep(0.40, 0.75, f + 0.15 * r.x));
  col = mix(col, cWarm, smoothstep(0.65, 0.95, f * 0.7 + 0.3 * length(r)));

  // Pointer-driven highlight (parallax-feeling glow).
  let pd = (in.uv - u.pointer) * vec2<f32>(aspect, 1.0);
  let glow = exp(-dot(pd, pd) * 8.0);
  col = col + cCream * glow * 0.18 * u.intensity;

  // Vignette + film grain.
  let centered = in.uv - vec2<f32>(0.5, 0.5);
  let vignette = 1.0 - dot(centered, centered) * 1.2;
  col = col * clamp(vignette, 0.55, 1.0);
  let grain = (hash21(in.uv * u.resolution + u.time) - 0.5) * 0.025;
  col = col + vec3<f32>(grain);

  return vec4<f32>(col, 1.0);
}
`;

interface Props {
  className?: string;
  /** Multiplier on the pointer glow. Default 1. */
  intensity?: number;
}

export default function WebGPUBackdrop({ className = '', intensity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let raf = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let uniformBuffer: GPUBuffer | null = null;

    const pointer = { x: 0.5, y: 0.5, target: { x: 0.5, y: 0.5 } };
    const onPointer = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      pointer.target.x = (e.clientX - rect.left) / rect.width;
      pointer.target.y = (e.clientY - rect.top) / rect.height;
    };
    wrap.addEventListener('pointermove', onPointer);

    const reduceMotion =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    (async () => {
      const device = await getWebGPUDevice();
      if (!device || disposed) {
        wrap.dataset.fallback = 'true';
        return;
      }

      const ctx = canvas.getContext('webgpu');
      if (!ctx) {
        wrap.dataset.fallback = 'true';
        return;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: 'premultiplied' });

      const module = device.createShaderModule({ code: SHADER });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      // 8 floats = 32 bytes, padded to 48 for std140-like alignment safety.
      uniformBuffer = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const uniformData = new Float32Array(12);

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => {
        const w = Math.max(1, Math.floor(wrap.clientWidth * dpr));
        const h = Math.max(1, Math.floor(wrap.clientHeight * dpr));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(wrap);

      const start = performance.now();
      const frame = () => {
        if (disposed) return;

        // Smooth pointer follow.
        pointer.x += (pointer.target.x - pointer.x) * 0.08;
        pointer.y += (pointer.target.y - pointer.y) * 0.08;

        const t = reduceMotion ? 0 : (performance.now() - start) / 1000;
        uniformData[0] = canvas.width;
        uniformData[1] = canvas.height;
        uniformData[2] = t;
        uniformData[4] = pointer.x;
        uniformData[5] = pointer.y;
        uniformData[6] = intensity;
        device.queue.writeBuffer(uniformBuffer!, 0, uniformData);

        const view = ctx.getCurrentTexture().createView();
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3, 1, 0, 0);
        pass.end();
        device.queue.submit([encoder.finish()]);

        if (reduceMotion) return; // single static frame
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })().catch((err) => {
      console.warn('[WebGPUBackdrop] init failed', err);
      wrap.dataset.fallback = 'true';
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      wrap.removeEventListener('pointermove', onPointer);
      uniformBuffer?.destroy();
    };
  }, [intensity]);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.fallback} />
    </div>
  );
}
