import { getWebGPUDevice } from './webgpu';

export interface ProcessOptions {
  src: string;
  maxWidth: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

interface CachedResult {
  url: string;
  width: number;
  height: number;
}

const cache = new Map<string, Promise<CachedResult>>();

const RESIZE_SHADER = /* wgsl */ `
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let outDim = textureDimensions(outputTex);
  if (gid.x >= outDim.x || gid.y >= outDim.y) { return; }

  let uv = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5)
         / vec2<f32>(f32(outDim.x), f32(outDim.y));

  let inDim = textureDimensions(inputTex);
  let texel = 1.0 / vec2<f32>(f32(inDim.x), f32(inDim.y));

  // 3x3 weighted (gaussian-ish) downsample for sharp + clean rescale.
  var sum = vec4<f32>(0.0);
  var totalW = 0.0;
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let offset = vec2<f32>(f32(dx), f32(dy)) * texel;
      let w = 1.0 / (1.0 + 0.5 * f32(dx * dx + dy * dy));
      sum = sum + textureSampleLevel(inputTex, smp, uv + offset, 0.0) * w;
      totalW = totalW + w;
    }
  }

  textureStore(outputTex, vec2<i32>(i32(gid.x), i32(gid.y)), sum / totalW);
}
`;

let pipelinePromise: Promise<{
  pipeline: GPUComputePipeline;
  sampler: GPUSampler;
}> | null = null;

function getPipeline(device: GPUDevice) {
  if (!pipelinePromise) {
    pipelinePromise = Promise.resolve().then(() => {
      const module = device.createShaderModule({ code: RESIZE_SHADER });
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
  return pipelinePromise;
}

function targetSize(naturalW: number, naturalH: number, maxW: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cap = Math.min(Math.round(maxW * dpr), naturalW);
  if (cap >= naturalW) return { w: naturalW, h: naturalH };
  const ratio = cap / naturalW;
  return { w: cap, h: Math.max(1, Math.round(naturalH * ratio)) };
}

async function resizeWithGPU(
  device: GPUDevice,
  bitmap: ImageBitmap,
  w: number,
  h: number,
  format: string,
  quality: number,
): Promise<Blob | null> {
  const { pipeline, sampler } = await getPipeline(device);

  const inputTex = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: inputTex },
    [bitmap.width, bitmap.height],
  );

  const outputTex = device.createTexture({
    size: [w, h],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: inputTex.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: outputTex.createView() },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
  pass.end();

  // 256-byte aligned rows for copyTextureToBuffer.
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
  readBuf.destroy();

  // Strip row padding.
  const tight = new Uint8ClampedArray(w * h * 4);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    tight.set(padded.subarray(y * bytesPerRow, y * bytesPerRow + rowBytes), y * rowBytes);
  }

  const offscreen = new OffscreenCanvas(w, h);
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;
  const imageData = new ImageData(tight, w, h);
  ctx.putImageData(imageData, 0, 0);
  return await offscreen.convertToBlob({ type: format, quality });
}

async function resizeWithCanvas(
  bitmap: ImageBitmap,
  w: number,
  h: number,
  format: string,
  quality: number,
): Promise<Blob | null> {
  const offscreen = new OffscreenCanvas(w, h);
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await offscreen.convertToBlob({ type: format, quality });
}

export async function processImage({
  src,
  maxWidth,
  quality = 0.85,
  format = 'image/webp',
}: ProcessOptions): Promise<CachedResult> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const key = `${src}|${maxWidth}|${dpr}|${format}|${quality}`;

  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<CachedResult> => {
    const response = await fetch(src);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const { w, h } = targetSize(bitmap.width, bitmap.height, maxWidth);

    if (w === bitmap.width && h === bitmap.height) {
      bitmap.close();
      return { url: src, width: w, height: h };
    }

    let outBlob: Blob | null = null;
    const device = await getWebGPUDevice();
    if (device) {
      try {
        outBlob = await resizeWithGPU(device, bitmap, w, h, format, quality);
      } catch (err) {
        console.warn('[imageProcessor] WebGPU resize failed, falling back', err);
      }
    }
    if (!outBlob) {
      outBlob = await resizeWithCanvas(bitmap, w, h, format, quality);
    }
    bitmap.close();

    if (!outBlob) {
      return { url: src, width: bitmap.width, height: bitmap.height };
    }
    return { url: URL.createObjectURL(outBlob), width: w, height: h };
  })();

  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}
