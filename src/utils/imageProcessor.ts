// WebGPU post-load enhancer: takes an already-loaded <img>, runs a sharpen +
// saturation pass on the GPU, and returns a blob URL the browser can swap in
// as a crisper, more vibrant version. Fast because the input is already a
// small WebP — no giant network fetches here. Falls back to a plain canvas
// pass if WebGPU isn't available.
import { getWebGPUDevice } from './webgpu';

const ENHANCE_SHADER = /* wgsl */ `
struct Params { sharpen: f32, saturation: f32, _pad0: f32, _pad1: f32 };

@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn applySaturation(c: vec3<f32>, s: f32) -> vec3<f32> {
  let luma = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  return mix(vec3<f32>(luma), c, s);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = textureDimensions(outputTex);
  if (gid.x >= dim.x || gid.y >= dim.y) { return; }

  let uv = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5)
         / vec2<f32>(f32(dim.x), f32(dim.y));
  let texel = 1.0 / vec2<f32>(f32(dim.x), f32(dim.y));

  let center = textureSampleLevel(inputTex, smp, uv, 0.0);
  let n = textureSampleLevel(inputTex, smp, uv + vec2<f32>( 0.0, -texel.y), 0.0);
  let s = textureSampleLevel(inputTex, smp, uv + vec2<f32>( 0.0,  texel.y), 0.0);
  let e = textureSampleLevel(inputTex, smp, uv + vec2<f32>( texel.x, 0.0), 0.0);
  let w = textureSampleLevel(inputTex, smp, uv + vec2<f32>(-texel.x, 0.0), 0.0);

  let sharpened = center.rgb + (center.rgb * 4.0 - n.rgb - s.rgb - e.rgb - w.rgb) * params.sharpen;
  let out = applySaturation(sharpened, params.saturation);
  textureStore(outputTex, vec2<i32>(i32(gid.x), i32(gid.y)),
               vec4<f32>(clamp(out, vec3<f32>(0.0), vec3<f32>(1.0)), center.a));
}
`;

interface PipelineCache {
  pipeline: GPUComputePipeline;
  sampler: GPUSampler;
}
let pipelineCache: Promise<PipelineCache> | null = null;

function getPipeline(device: GPUDevice) {
  if (!pipelineCache) {
    pipelineCache = Promise.resolve().then(() => {
      const module = device.createShaderModule({ code: ENHANCE_SHADER });
      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
      const sampler = device.createSampler({
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
      return { pipeline, sampler };
    });
  }
  return pipelineCache;
}

export interface EnhanceOptions {
  sharpen?: number;
  saturation?: number;
}

const enhanceCache = new Map<string, Promise<string>>();

export function enhanceImage(
  src: string,
  bitmap: ImageBitmap,
  opts: EnhanceOptions = {},
): Promise<string> {
  const sharpen = opts.sharpen ?? 0.18;
  const saturation = opts.saturation ?? 1.08;
  const key = `${src}|${sharpen}|${saturation}`;
  const cached = enhanceCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const w = bitmap.width;
    const h = bitmap.height;

    const device = await getWebGPUDevice();
    if (device) {
      try {
        return await runWebGPU(device, bitmap, w, h, sharpen, saturation);
      } catch (err) {
        console.warn('[enhanceImage] WebGPU enhance failed, falling back', err);
      }
    }
    return runCanvas(bitmap, w, h, saturation);
  })();

  enhanceCache.set(key, promise);
  promise.catch(() => enhanceCache.delete(key));
  return promise;
}

async function runWebGPU(
  device: GPUDevice,
  bitmap: ImageBitmap,
  w: number,
  h: number,
  sharpen: number,
  saturation: number,
): Promise<string> {
  const { pipeline, sampler } = await getPipeline(device);

  const inputTex = device.createTexture({
    size: [w, h],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: inputTex },
    [w, h],
  );

  const outputTex = device.createTexture({
    size: [w, h],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  const params = new Float32Array([sharpen, saturation, 0, 0]);
  const paramBuf = device.createBuffer({
    size: params.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(paramBuf, 0, params);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: inputTex.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: outputTex.createView() },
      { binding: 3, resource: { buffer: paramBuf } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
  pass.end();

  const bytesPerRow = Math.ceil((w * 4) / 256) * 256;
  const readBuf = device.createBuffer({
    size: bytesPerRow * h,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyTextureToBuffer(
    { texture: outputTex },
    { buffer: readBuf, bytesPerRow },
    [w, h],
  );
  device.queue.submit([encoder.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const padded = new Uint8ClampedArray(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  inputTex.destroy();
  outputTex.destroy();
  paramBuf.destroy();
  readBuf.destroy();

  const tight = new Uint8ClampedArray(w * h * 4);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    tight.set(padded.subarray(y * bytesPerRow, y * bytesPerRow + rowBytes), y * rowBytes);
  }

  const offscreen = new OffscreenCanvas(w, h);
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.putImageData(new ImageData(tight, w, h), 0, 0);
  const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.9 });
  return URL.createObjectURL(blob);
}

async function runCanvas(
  bitmap: ImageBitmap,
  w: number,
  h: number,
  saturation: number,
): Promise<string> {
  const offscreen = new OffscreenCanvas(w, h);
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.filter = `saturate(${saturation}) contrast(1.04)`;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.9 });
  return URL.createObjectURL(blob);
}
