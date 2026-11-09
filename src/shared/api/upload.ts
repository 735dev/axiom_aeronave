import { env } from '@/shared/config/env';

/** Convierte un `data:` URL en un archivo real, para enviarlo como multipart. */
export function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return new Blob([], { type: fallbackMime });
  const mime = match[1] || fallbackMime;
  const raw = match[2] ? atob(match[3] ?? '') : decodeURIComponent(match[3] ?? '');
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

interface UploadSource {
  name: string;
  mime: string;
  data_url: string;
}

/**
 * Cuerpo de una subida. El servidor real recibe `multipart/form-data` con el
 * archivo (un `data_url` de 20 MB en base64 no cabe en un JSON razonable); el
 * simulador en memoria sigue leyendo el JSON con `data_url`.
 */
export function uploadBody<T extends UploadSource>(
  file: T,
  extra: Record<string, string | undefined> = {},
): Record<string, unknown> | FormData {
  if (env.useMocks) return { ...file, ...extra };
  const body = new FormData();
  body.append('file', dataUrlToBlob(file.data_url, file.mime), file.name);
  Object.entries(extra).forEach(([k, v]) => {
    if (v) body.append(k, v);
  });
  return body;
}
