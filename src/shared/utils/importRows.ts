import { toCsv } from './csv';

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 1_000_000;

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  dry_run: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

export type ImportProblem =
  | { code: 'empty' }
  | { code: 'tooMany'; max: number; total: number }
  | { code: 'missingColumns'; columns: string[] };

export interface PreparedImport {
  /** Solo las columnas esperadas, en orden; lo que el CSV traiga de más se descarta. */
  rows: Record<string, string>[];
  /** Columnas del CSV que la plantilla no conoce (se ignoran, pero se avisa). */
  ignored: string[];
  problem?: ImportProblem;
}

/** Valida la forma del CSV contra la plantilla antes de gastar una petición. */
export function prepareImport(
  parsed: Record<string, string>[],
  columns: string[],
  required: string[],
  maxRows = IMPORT_MAX_ROWS,
): PreparedImport {
  if (parsed.length === 0) return { rows: [], ignored: [], problem: { code: 'empty' } };
  const present = new Set(Object.keys(parsed[0]!));
  const missing = required.filter((c) => !present.has(c));
  const ignored = [...present].filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    return { rows: [], ignored, problem: { code: 'missingColumns', columns: missing } };
  }
  if (parsed.length > maxRows) {
    return { rows: [], ignored, problem: { code: 'tooMany', max: maxRows, total: parsed.length } };
  }
  const rows = parsed.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? ''])));
  return { rows, ignored };
}

/** Plantilla descargable: solo las cabeceras. */
export function templateCsv(columns: string[]): string {
  return toCsv(
    columns.map((c) => ({ header: c, value: (row: Record<string, string>) => row[c] })),
    [],
  );
}

/** Fila 1 del CSV = cabeceras, así que la fila de datos `n` del servidor es la línea `n + 1`. */
export function describeRowError(e: ImportRowError): string {
  return `${e.row}${e.field ? ` · ${e.field}` : ''}: ${e.message}`;
}
