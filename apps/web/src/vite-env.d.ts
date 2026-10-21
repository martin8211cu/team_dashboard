/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public API URL (e.g. https://api.example.com). Omit for same-origin /api proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
