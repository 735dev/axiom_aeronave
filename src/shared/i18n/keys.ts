import es from './locales/es.json';

type Leaves<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${Leaves<T[K]>}` : K) : never }[keyof T]
  : never;

export type TranslationKey = Leaves<typeof es>;
