import { AxiosError } from 'axios';
import { ApiError } from './types';

interface RawBody {
  detail?: string;
  status?: number;
  message?: string;
  title?: string;
  codigo?: string;
  errors?: Record<string, string | string[]>;
}

export function handleErrorAxios(error: AxiosError<RawBody>): ApiError {
  const r = error.response;
  if (!r) {
    return { ok: false, status: 0, title: 'errors.network', detail: 'errors.network' };
  }
  const body = (r.data ?? {}) as RawBody;
  const fieldErrors =
    body.errors &&
    Object.fromEntries(
      Object.entries(body.errors).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)]),
    );

  return {
    ok: false,
    status: r.status,
    title: body.title || body.message || mapDefaultTitle(r.status),
    detail: body.detail || body.message || mapDefaultDetail(r.status),
    fieldErrors,
    ...(body.codigo ? { codigo: body.codigo } : {}),
    ...retryAfterOf(r.headers),
  };
}

function retryAfterOf(headers: unknown): { retryAfter?: number } {
  const raw = (headers as { get?: (k: string) => unknown } | undefined)?.get?.('retry-after');
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? { retryAfter: seconds } : {};
}

export function handleMessageAxios(result: RawBody): ApiError {
  return {
    ok: false,
    status: result.status ?? 400,
    title: result.title || result.message || mapDefaultTitle(result.status ?? 400),
    detail: result.detail || result.message || mapDefaultDetail(result.status ?? 400),
    ...(result.codigo ? { codigo: result.codigo } : {}),
  };
}

export function isSuccessfully(
  status: string | number | undefined | null,
  response: unknown = null,
  customId: string | string[] | null = null,
): boolean {
  if (customId && response && typeof response === 'object') {
    const keys = Array.isArray(customId) ? customId : [customId];
    if (keys.some((k) => k in (response as Record<string, unknown>))) return true;
  }
  if (typeof status === 'number' && status >= 200 && status < 300) return true;
  if (typeof status === 'string' && status === 'OK') return true;
  return false;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
  });
  return usp.toString();
}

function mapDefaultTitle(s: number) {
  if (s === 401) return 'errors.unauthorizedTitle';
  if (s === 403) return 'errors.forbiddenTitle';
  if (s === 404) return 'errors.notFoundTitle';
  if (s === 409) return 'errors.conflictTitle';
  if (s === 429) return 'errors.tooManyTitle';
  if (s === 422) return 'errors.validationTitle';
  if (s >= 500) return 'errors.serverTitle';
  return 'errors.genericTitle';
}

function mapDefaultDetail(s: number) {
  if (s === 401) return 'errors.unauthorizedDetail';
  if (s === 403) return 'errors.forbiddenDetail';
  if (s === 404) return 'errors.notFoundDetail';
  if (s === 409) return 'errors.conflictDetail';
  if (s === 429) return 'errors.tooManyDetail';
  if (s === 422) return 'errors.validationDetail';
  if (s >= 500) return 'errors.serverDetail';
  return 'errors.genericDetail';
}
