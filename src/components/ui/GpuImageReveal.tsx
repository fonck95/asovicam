import { useEffect, useRef } from 'react';
import { getWebGPUDevice } from '../../utils/webgpu';
import styles from './GpuImage.module.css';

const SHADER = /* wgsl */ `
struct Uniforms {
  canvas_size: vec2<f32>,
  image_size: vec2<f32>,
  progress: f32,
  time: f32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var image_sampler: sampler;
@group(0) @binding(1) var image_texture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vertex_main(@builtin(vertex_index) index: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  let p = positions[index];
  var output: VertexOutput;
  output.position = vec4<f32>(p, 0.0, 1.0);
  output.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return output;
}

fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let canvas_aspect = u.canvas_size.x / max(u.canvas_size.y, 1.0);
  let image_aspect = u.image_size.x / max(u.image_size.y, 1.0);
  var sample_uv = input.uv;

  if (image_aspect > canvas_aspect) {
    sample_uv.x = (sample_uv.x - 0.5) * (canvas_aspect / image_aspect) + 0.5;
  } else {
    sample_uv.y = (sample_uv.y - 0.5) * (image_aspect / canvas_aspect) + 0.5;
  }

  let pixel = input.uv * u.canvas_size * 0.075;
  let grain = hash21(floor(pixel)) * 0.22;
  let sweep = input.uv.y * 0.62 + input.uv.x * 0.12 + grain;
  let edge = smoothstep(sweep - 0.10, sweep + 0.10, u.progress * 1.08);
  let image = textureSample(image_texture, image_sampler, sample_uv);
  let warm_edge = vec3<f32>(0.96, 0.74, 0.32) * (1.0 - abs(edge - 0.5) * 2.0) * 0.13;

  return vec4<f32>(image.rgb + warm_edge, image.a * edge);
}
`;

interface Props {
  image: HTMLImageElement;
  onReady: () => void;
  onComplete: () => void;
}

export default function GpuImageReveal({ image, onReady, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image.naturalWidth || !image.naturalHeight) {
      onComplete();
      return;
    }

    let cancelled = false;
    let raf = 0;
    let texture: GPUTexture | null = null;
    let uniformBuffer: GPUBuffer | null = null;

    const run = async () => {
      const device = await getWebGPUDevice();
      if (!device || cancelled) {
        onComplete();
        return;
      }

      const context = canvas.getContext('webgpu');
      if (!context) {
        onComplete();
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'premultiplied' });

      const module = device.createShaderModule({ code: SHADER });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vertex_main' },
        fragment: {
          module,
          entryPoint: 'fragment_main',
          targets: [
            {
              format,
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
              },
            },
          ],
        },
        primitive: { topology: 'triangle-list' },
      });

      texture = device.createTexture({
        size: [image.naturalWidth, image.naturalHeight, 1],
        format: 'rgba8unorm-srgb',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture(
        { source: image },
        { texture },
        [image.naturalWidth, image.naturalHeight],
      );

      uniformBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: device.createSampler({
              magFilter: 'linear',
              minFilter: 'linear',
            }),
          },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } },
        ],
      });

      onReady();
      const startedAt = performance.now();
      const duration = 920;

      const frame = (now: number) => {
        if (cancelled || !uniformBuffer) return;
        const linear = Math.min(1, (now - startedAt) / duration);
        const progress = 1 - Math.pow(1 - linear, 3);

        device.queue.writeBuffer(
          uniformBuffer,
          0,
          new Float32Array([
            canvas.width,
            canvas.height,
            image.naturalWidth,
            image.naturalHeight,
            progress,
            now / 1000,
            0,
            0,
          ]),
        );

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);

        if (linear < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          onComplete();
        }
      };

      raf = requestAnimationFrame(frame);
    };

    run().catch(() => onComplete());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      texture?.destroy();
      uniformBuffer?.destroy();
    };
  }, [image, onComplete, onReady]);

  return <canvas ref={canvasRef} className={styles.gpuCanvas} aria-hidden="true" />;
}
