import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/shared/config/env';
import { getStoreRef } from '@/shared/store';
import { showInfoModal } from '@/shared/store/slices/uiSlice';
import { logout, tokensRefreshed } from '@/shared/store/slices/authSlice';
import { mockAdapter } from './mock';

export const httpClient: AxiosInstance = axios.create({
  baseURL: `${env.apiUrl}${env.apiVersion}`,
  timeout: env.timeoutMs,
  headers: { 'Content-Type': 'application/json' },
  ...(env.useMocks ? { adapter: mockAdapter } : {}),
});

httpClient.interceptors.request.use((config) => {
  const state = getStoreRef()?.getState();
  const token = state?.auth.token;
  const lang = state?.lang.current === 'en' ? 'en-US' : 'es-ES';

  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = lang;
  return config;
});

/** Rutas de sesión: un 401 aquí es "credenciales inválidas", no "sesión vencida". */
const SESSION_PATHS = ['/auth/login/', '/auth/refresh/'];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshing: Promise<boolean> | null = null;

/**
 * Cambia el refresh token por un par nuevo. Una sola petición a la vez: varias
 * llamadas que vencen juntas comparten el mismo intento (el servidor rota el par).
 */
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const store = getStoreRef();
  const refreshToken = store?.getState().auth.refreshToken;
  if (!store || !refreshToken) return Promise.resolve(false);
  refreshing = axios
    .post<{ token: string; refresh_token?: string }>(
      `${env.apiUrl}${env.apiVersion}/auth/refresh/`,
      { refresh_token: refreshToken },
      { timeout: env.timeoutMs },
    )
    .then((res) => {
      store.dispatch(
        tokensRefreshed({ token: res.data.token, refreshToken: res.data.refresh_token }),
      );
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const status = error.response?.status ?? 0;
    const store = getStoreRef();
    const config = error.config as RetriableConfig | undefined;
    const isSessionCall = SESSION_PATHS.some((p) => config?.url?.startsWith(p));

    if (status === 401 && isSessionCall) return Promise.reject(error);

    if (status === 401 && store) {
      // El access token dura poco: antes de echar al usuario se intenta renovarlo una vez.
      if (!env.useMocks && config && !config._retried && (await refreshSession())) {
        config._retried = true;
        return httpClient.request(config);
      }
      store.dispatch(logout());
      window.location.replace('/login');
      return Promise.reject(error);
    }

    if (status >= 500 && store) {
      store.dispatch(
        showInfoModal({
          type: 'error',
          code: status,
          description: 'errors.serverDetail',
        }),
      );
    }

    return Promise.reject(error);
  },
);
