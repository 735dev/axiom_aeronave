import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { httpClient } from './client';

type FormPrimitive = string | number | boolean | Blob | File;
type FormValue = FormPrimitive | null | undefined;
export type FormPayload = Record<string, FormValue | FormValue[]>;

export interface ApiArgs {
  url: string;
  data?: FormPayload | FormData;
  config?: AxiosRequestConfig;
  isWWWUrl?: boolean;
  showToast?: boolean;
  loadingMessage?: string;
}

type Req = Promise<AxiosResponse<any>>;

function hasFiles(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return Object.values(data as object).some(
    (v) =>
      v instanceof File ||
      v instanceof Blob ||
      (Array.isArray(v) && v.some((i) => i instanceof File || i instanceof Blob)),
  );
}

function toFormData(data: FormPayload): FormData {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => x != null && fd.append(k, x as string | Blob));
    else if (v != null) fd.append(k, v as string | Blob);
  });
  return fd;
}

function toUrlEncoded(data: FormPayload): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((x) => x != null && params.append(k, String(x)));
    else if (v != null) params.append(k, String(v));
  });
  return params;
}

function withToast(p: Req, loading = 'Cargando…'): Req {
  toast.promise(p, { loading });
  return p;
}

const json = {
  get: (a: ApiArgs): Req => httpClient.get(a.url, a.config),
  post: (a: ApiArgs): Req => httpClient.post(a.url, a.data, a.config),
  put: (a: ApiArgs): Req => httpClient.put(a.url, a.data, a.config),
  patch: (a: ApiArgs): Req => httpClient.patch(a.url, a.data, a.config),
  delete: (a: ApiArgs): Req => httpClient.delete(a.url, a.config),
};

function multipart(a: ApiArgs) {
  const body = a.data instanceof FormData ? a.data : toFormData((a.data ?? {}) as FormPayload);
  const config: AxiosRequestConfig = {
    ...a.config,
    headers: { ...a.config?.headers, 'Content-Type': 'multipart/form-data' },
  };
  return { body, config };
}

const form = {
  post: (a: ApiArgs): Req => {
    const { body, config } = multipart(a);
    return httpClient.post(a.url, body, config);
  },
  put: (a: ApiArgs): Req => {
    const { body, config } = multipart(a);
    return httpClient.put(a.url, body, config);
  },
  patch: (a: ApiArgs): Req => {
    const { body, config } = multipart(a);
    return httpClient.patch(a.url, body, config);
  },
};

function urlEncodedConfig(a: ApiArgs): AxiosRequestConfig {
  return {
    ...a.config,
    headers: { ...a.config?.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
  };
}

const urlEncoded = {
  post: (a: ApiArgs): Req =>
    httpClient.post(a.url, toUrlEncoded(a.data as FormPayload), urlEncodedConfig(a)),
  put: (a: ApiArgs): Req =>
    httpClient.put(a.url, toUrlEncoded(a.data as FormPayload), urlEncodedConfig(a)),
  patch: (a: ApiArgs): Req =>
    httpClient.patch(a.url, toUrlEncoded(a.data as FormPayload), urlEncodedConfig(a)),
};

function pickRequest(a: ApiArgs, jsonReq: () => Req, formReq: () => Req, urlReq: () => Req): Req {
  if (a.isWWWUrl) return urlReq();
  if (a.data instanceof FormData || hasFiles(a.data)) return formReq();
  return jsonReq();
}

export const apiAxios = {
  get: (a: ApiArgs) => (a.showToast ? withToast(json.get(a), a.loadingMessage) : json.get(a)),
  delete: (a: ApiArgs) =>
    a.showToast ? withToast(json.delete(a), a.loadingMessage) : json.delete(a),
  post: (a: ApiArgs) => {
    const req = pickRequest(a, () => json.post(a), () => form.post(a), () => urlEncoded.post(a));
    return a.showToast ? withToast(req, a.loadingMessage) : req;
  },
  put: (a: ApiArgs) => {
    const req = pickRequest(a, () => json.put(a), () => form.put(a), () => urlEncoded.put(a));
    return a.showToast ? withToast(req, a.loadingMessage) : req;
  },
  patch: (a: ApiArgs) => {
    const req = pickRequest(a, () => json.patch(a), () => form.patch(a), () => urlEncoded.patch(a));
    return a.showToast ? withToast(req, a.loadingMessage) : req;
  },
};
