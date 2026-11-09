import { useEffect, useState } from 'react';
import { AttachmentLink, getAttachmentLink } from '../api/ticketsApi';

/** Margen antes del vencimiento en el que se pide un enlace nuevo. */
const REFRESH_MARGIN_MS = 30_000;

const cache = new Map<string, AttachmentLink>();

function isFresh(link: AttachmentLink | undefined, now: number): link is AttachmentLink {
  return Boolean(link) && Date.parse(link!.expires_at) - now > REFRESH_MARGIN_MS;
}

/**
 * Enlace al original de un soporte. Blackbox firma enlaces que vencen a los
 * pocos minutos, así que no se guardan en el ticket: se piden cuando hacen
 * falta y se renuevan antes de que caduquen.
 */
export function useAttachmentUrl(ticketId: string, fileId: string) {
  const key = `${ticketId}:${fileId}`;
  const [url, setUrl] = useState<string | undefined>(() => {
    const hit = cache.get(key);
    return isFresh(hit, Date.now()) ? hit.url : undefined;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      const hit = cache.get(key);
      if (isFresh(hit, Date.now())) {
        setUrl(hit.url);
        schedule(hit);
        return;
      }
      const res = await getAttachmentLink(ticketId, fileId);
      if (cancelled) return;
      if (!res.ok) {
        setFailed(true);
        return;
      }
      cache.set(key, res.data);
      setUrl(res.data.url);
      setFailed(false);
      schedule(res.data);
    };

    const schedule = (link: AttachmentLink) => {
      const wait = Math.max(1_000, Date.parse(link.expires_at) - Date.now() - REFRESH_MARGIN_MS);
      timer = window.setTimeout(() => void load(), wait);
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [key, ticketId, fileId]);

  return { url, failed };
}

/** Solo para pruebas: vacía los enlaces recordados. */
export function resetAttachmentLinks() {
  cache.clear();
}
