/** Título del modal. Un código sin clave (p. ej. red = 0 antes de traducirlo) no se muestra crudo. */
export function resolveModalTitle(
  translate: (key: string) => string,
  code: number | string | undefined,
): string {
  const key = `errors.title.${code ?? 'generic'}`;
  const value = translate(key);
  return value === key ? translate('errors.title.generic') : value;
}
