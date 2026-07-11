/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base del API del backend, p. ej. https://api.asovicam.org (sin barra final). */
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
