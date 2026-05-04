let cachedDevice: Promise<GPUDevice | null> | null = null;

export function getWebGPUDevice(): Promise<GPUDevice | null> {
  if (cachedDevice) return cachedDevice;

  cachedDevice = (async () => {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
    try {
      // Chromium ignores powerPreference on Windows and logs a console
      // warning (crbug.com/369219127). Skip the option there to keep the
      // console clean; on other platforms the hint helps on hybrid GPUs.
      const isWindows = /Windows/i.test(navigator.userAgent ?? '');
      const adapter = await navigator.gpu.requestAdapter(
        isWindows ? undefined : { powerPreference: 'low-power' }
      );
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
