import { useEffect, useRef, useState } from 'react';
import { getWebGPUDevice, supportsWebGPU } from '../../utils/webgpu';
import styles from './HeroGpuCanvas.module.css';

// Full-screen quad shader. The fragment stage runs a layered domain-warp
// noise field (cheap fbm) tinted with the brand greens + harvest oranges, and
// is animated by a uniform clock + pointer position. Designed to be
// expressive but to drop to ~10ms/frame on integrated GPUs.
const SHADER = /* wgsl */ `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  pointer_x: f32,
  pointer_y: f32,
  intensity: f32,
  _pad0: f32,
  _pad1: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> VsOut {
  // Two-triangle fullscreen strip.
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );
  let p = positions[idx];
  var out: VsOut;
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = p * 0.5 + vec2<f32>(0.5, 0.5);
  return out;
}

fn hash21(p: vec2<f32>) -> f32 {
  let q = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
  return fract(sin(dot(q, vec2<f32>(1.0, 1.0))) * 43758.5453);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + a * noise(q);
    q = q * 2.02;
    a = a * 0.5;
  }
  return v;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(u.resolution.y, 1.0);
  var uv = in.uv;
  uv.x = (uv.x - 0.5) * aspect + 0.5;

  let t = u.time * 0.06;
  let pointer = vec2<f32>(u.pointer_x, u.pointer_y);

  // Domain warp: nested fbm calls bend the coordinate system into rolling fields.
  let q = vec2<f32>(fbm(uv * 2.4 + vec2<f32>(0.0, t)),
                    fbm(uv * 2.4 + vec2<f32>(5.2, -t * 0.8)));
  let r = vec2<f32>(fbm(uv * 2.0 + q + vec2<f32>(1.7, 9.2) + 0.18 * t),
                    fbm(uv * 2.0 + q + vec2<f32>(8.3, 2.8) + 0.13 * t));
  let f = fbm(uv * 2.4 + r);

  // Pointer-driven energetic ripple.
  let pd = distance(uv, pointer * vec2<f32>(aspect, 1.0));
  let pulse = exp(-pd * 5.0) * (0.5 + 0.5 * sin(u.time * 1.6 - pd * 14.0));

  // Brand palette (Magdalena Medio: deep forest, milpa green, harvest amber).
  let deep = vec3<f32>(0.020, 0.180, 0.085);
  let leaf = vec3<f32>(0.085, 0.396, 0.205);
  let lime = vec3<f32>(0.525, 0.937, 0.674);
  let amber = vec3<f32>(0.992, 0.745, 0.396);

  let v = clamp(f * 1.35, 0.0, 1.0);
  var col = mix(deep, leaf, smoothstep(0.15, 0.55, v));
  col = mix(col, lime, smoothstep(0.55, 0.90, v));
  col = col + amber * pulse * 0.55 * u.intensity;

  // Grain to keep banding away on dark gradients.
  let grain = (hash21(in.uv * u.resolution + u.time) - 0.5) * 0.025;
  col = col + vec3<f32>(grain);

  // Vignette so text in the foreground stays readable.
  let vd = distance(in.uv, vec2<f32>(0.5, 0.5));
  let vignette = smoothstep(0.95, 0.30, vd);
  col = col * mix(0.55, 1.0, vignette);

  return vec4<f32>(col, 1.0);
}
`;

interface HeroGpuCanvasProps {
  className?: string;
  intensity?: number;
}

export default function HeroGpuCanvas({ className = '', intensity = 1.0 }: HeroGpuCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !supportsWebGPU()) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let cancelled = false;
    let isVisible = true;
    let renderFrame: FrameRequestCallback | null = null;
    const pointer = { x: 0.5, y: 0.4 };

    let ctx: GPUCanvasContext | null = null;
    let device: GPUDevice | null = null;
    let pipeline: GPURenderPipeline | null = null;
    let uniformBuf: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;
    let format: GPUTextureFormat = 'bgra8unorm';

    const handlePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / rect.width;
      pointer.y = (e.clientY - rect.top) / rect.height;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    (async () => {
      device = await getWebGPUDevice();
      if (!device || cancelled) return;

      const gpuCtx = canvas.getContext('webgpu');
      if (!gpuCtx) return;
      ctx = gpuCtx;

      format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: 'premultiplied' });

      const module = device.createShaderModule({ code: SHADER });
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      uniformBuf = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
      });

      resize();
      setActive(true);

      const start = performance.now();
      const frame: FrameRequestCallback = (now) => {
        raf = 0;
        if (
          cancelled ||
          !isVisible ||
          document.hidden ||
          !device ||
          !ctx ||
          !pipeline ||
          !uniformBuf ||
          !bindGroup
        ) return;
        const t = (now - start) / 1000;
        const data = new Float32Array([
          canvas.width,
          canvas.height,
          t,
          pointer.x,
          pointer.y,
          intensity,
          0,
          0,
        ]);
        device.queue.writeBuffer(uniformBuf, 0, data);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: ctx.getCurrentTexture().createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);

        if (!reduceMotion) {
          raf = requestAnimationFrame(frame);
        }
      };
      renderFrame = frame;
      raf = requestAnimationFrame(frame);
    })().catch((err) => console.warn('[HeroGpuCanvas] init failed', err));

    const onResize = () => resize();
    const pointerTarget = canvas.parentElement ?? canvas;
    const onVisibilityChange = () => {
      if (!document.hidden && isVisible && renderFrame && !raf) {
        raf = requestAnimationFrame(renderFrame);
      }
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible && renderFrame && !raf) {
          raf = requestAnimationFrame(renderFrame);
        }
      },
      { rootMargin: '120px' },
    );
    visibilityObserver.observe(canvas);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    pointerTarget.addEventListener('pointermove', handlePointer as EventListener);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      visibilityObserver.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      pointerTarget.removeEventListener('pointermove', handlePointer as EventListener);
      uniformBuf?.destroy();
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className}`}
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
    />
  );
}
