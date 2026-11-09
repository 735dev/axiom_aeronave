export const env = {
  apiUrl: import.meta.env.VITE_PUBLIC_URL_API,
  apiVersion: import.meta.env.VITE_PUBLIC_URL_VERSION ?? '',
  limit: Number(import.meta.env.VITE_PUBLIC_LIMIT ?? 10),
  defaultLang: (import.meta.env.VITE_PUBLIC_DEFAULT_LANG ?? 'es') as 'es' | 'en',
  defaultTheme: (import.meta.env.VITE_PUBLIC_DEFAULT_THEME ?? 'system') as 'light' | 'dark' | 'system',
  timeoutMs: Number(import.meta.env.VITE_PUBLIC_TIMEOUT_MS ?? 15000),
  useMocks: String(import.meta.env.VITE_PUBLIC_USE_MOCKS ?? 'false') === 'true',
} as const;
