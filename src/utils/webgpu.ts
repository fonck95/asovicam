let cachedDevice: Promise<GPUDevice | null> | null = null;

export function getWebGPUDevice(): Promise<GPUDevice | null> {
  if (cachedDevice) return cachedDevice;

  cachedDevice = (async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'low-power',
      });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      device.lost.then(() => {
        cachedDevice = null;
      });
      return device;
    } catch {
      return null;
    }
  })();

  return cachedDevice;
}

export function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
