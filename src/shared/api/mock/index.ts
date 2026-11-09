import { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { routeMockRequest } from './router';

const LATENCY_MS = 320;

function splitUrl(config: InternalAxiosRequestConfig): { path: string; query: URLSearchParams } {
  const raw = config.url ?? '';
  const [path = '', search = ''] = raw.split('?');
  return { path, query: new URLSearchParams(search) };
}

/**
 * Adaptador de axios que responde con datos en memoria.
 * Se activa solo con VITE_PUBLIC_USE_MOCKS=true. Al conectar el backend real
 * se apaga la bandera y ningún archivo de feature cambia.
 */
export const mockAdapter: AxiosAdapter = async (config) => {
  const { path, query } = splitUrl(config);
  const method = (config.method ?? 'get').toLowerCase();

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  const auth = String(config.headers?.Authorization ?? '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  const result = routeMockRequest({
    method,
    path,
    query,
    body: config.data,
    token,
    idempotencyKey: String(config.headers?.['Idempotency-Key'] ?? '') || undefined,
  });

  const response: AxiosResponse = {
    data: result.data,
    status: result.status,
    statusText: String(result.status),
    headers: {},
    config,
  };

  if (result.status >= 400) {
    throw new AxiosError(
      `Mock ${result.status}`,
      String(result.status),
      config,
      null,
      response,
    );
  }

  return response;
};
