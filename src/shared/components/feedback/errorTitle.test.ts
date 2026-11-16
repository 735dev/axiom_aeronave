import { describe, expect, it } from 'vitest';
import en from '@/shared/i18n/locales/en.json';
import es from '@/shared/i18n/locales/es.json';
import { resolveModalTitle } from './errorTitle';

function dictionaryTranslate(dict: { errors: { title: Record<string, string> } }) {
  return (key: string) => {
    const title = key.match(/^errors\.title\.(.+)$/);
    if (!title) return key;
    return dict.errors.title[title[1] ?? ''] ?? key;
  };
}

describe('resolveModalTitle', () => {
  it('traduce un fallo de red (estado 0) en vez de mostrar la clave', () => {
    expect(resolveModalTitle(dictionaryTranslate(es), 0)).toBe('Sin conexión');
    expect(resolveModalTitle(dictionaryTranslate(en), 0)).toBe('No connection');
  });

  it('usa el aviso genérico cuando el código no tiene traducción', () => {
    expect(resolveModalTitle(dictionaryTranslate(es), 409)).toBe('Aviso');
  });
});
