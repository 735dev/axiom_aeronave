import { useCallback } from 'react';
import { useAppSelector } from '@/shared/store/hooks';
import es from '@/shared/i18n/locales/es.json';
import en from '@/shared/i18n/locales/en.json';

const dictionaries = { es, en } as const;

function getDeep(obj: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
  return typeof value === 'string' ? value : undefined;
}

export function useT() {
  const lang = useAppSelector((s) => s.lang.current);
  return useCallback(
    (keyOrText: string, vars?: Record<string, string | number>): string => {
      if (keyOrText.includes('|')) {
        const [k, ...args] = keyOrText.split('|');
        const v = getDeep(dictionaries[lang], k ?? '') ?? k ?? '';
        return v.replace(/\{n\}/g, args[0] ?? '');
      }
      let value = getDeep(dictionaries[lang], keyOrText);
      if (value === undefined) return keyOrText;
      if (vars) Object.entries(vars).forEach(([k, v]) => (value = value!.replace(`{${k}}`, String(v))));
      return value;
    },
    [lang],
  );
}
