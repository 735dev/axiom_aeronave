/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_URL_API: string;
  readonly VITE_PUBLIC_URL_VERSION: string;
  readonly VITE_PUBLIC_LIMIT: string;
  readonly VITE_PUBLIC_DEFAULT_LANG: string;
  readonly VITE_PUBLIC_DEFAULT_THEME: string;
  readonly VITE_PUBLIC_TIMEOUT_MS: string;
  readonly VITE_PUBLIC_USE_MOCKS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
