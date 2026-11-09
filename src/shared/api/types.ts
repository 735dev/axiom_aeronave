export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  links: { next: string | null; previous: string | null };
}

export interface ApiError {
  ok: false;
  status: number;
  title: string;
  detail: string;
  fieldErrors?: Record<string, string>;
  /** Código estable del servidor (`periodo_cerrado`, `idempotencia`…): no depende del texto. */
  codigo?: string;
  /** Segundos que indica `Retry-After` cuando el servidor limita la tasa (429). */
  retryAfter?: number;
}

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export type ApiResult<T> = ApiOk<T> | ApiError;

export const isOk = <T>(r: ApiResult<T>): r is ApiOk<T> => r.ok === true;
export const isErr = <T>(r: ApiResult<T>): r is ApiError => r.ok === false;
