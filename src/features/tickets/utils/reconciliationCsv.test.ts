import { describe, expect, it } from 'vitest';
import { ReconciliationRow } from '../types/reconciliation.types';
import { buildReconciliationCsv, csvCell, neutralizeFormula } from './reconciliationCsv';

const labels = {
  headers: ['Gasto', 'Operación', 'Descripción'],
  state: (s: string) => `E:${s}`,
  kind: (k: string) => `K:${k}`,
};

function row(over: Partial<ReconciliationRow> = {}): ReconciliationRow {
  return {
    ticket_id: 't1',
    code: 'TK-0001',
    operation_code: 'YV2323-004-26',
    title: 'Combustible',
    concept: 'fuel',
    date: '2026-11-03',
    status_name: 'Registrado',
    amount: 1850.5,
    currency: 'USD',
    amount_base: 1850.5,
    base_currency: 'USD',
    validated_receipts: 1,
    state: 'reconciled',
    difference_kinds: [],
    ...over,
  };
}

describe('csvCell', () => {
  it('encierra el texto entre comillas', () => {
    expect(csvCell('hola')).toBe('"hola"');
  });

  it('duplica las comillas internas', () => {
    expect(csvCell('dijo "sí"')).toBe('"dijo ""sí"""');
  });

  it('conserva el separador y los saltos de línea dentro de la celda', () => {
    expect(csvCell('a;b\nc')).toBe('"a;b\nc"');
  });

  it.each(['=SUM(A1)', '+1', '-1+2', '@cmd', '\t=1', '\r=1'])(
    'neutraliza la fórmula %j anteponiendo una comilla simple',
    (text) => {
      expect(csvCell(text).startsWith(`"'`)).toBe(true);
    },
  );

  it('no altera un texto que solo contiene = en medio', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
  });

  it('un número va con coma decimal y sin guard (un monto negativo es legítimo)', () => {
    expect(csvCell(1850.5)).toBe('"1850,50"');
    expect(csvCell(-5)).toBe('"-5,00"');
  });

  it('null y undefined quedan vacíos', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('neutralizeFormula deja intacto lo que no empieza con símbolo', () => {
    expect(neutralizeFormula('Combustible')).toBe('Combustible');
  });
});

describe('buildReconciliationCsv', () => {
  it('empieza con BOM UTF-8 para que Excel respete los acentos', () => {
    expect(buildReconciliationCsv([], labels).charCodeAt(0)).toBe(0xfeff);
  });

  it('separa con punto y coma y termina cada línea con CRLF', () => {
    const csv = buildReconciliationCsv([row()], labels);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('"Gasto";"Operación";"Descripción"');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('');
    expect(lines[1]!.split('";"')).toHaveLength(15);
  });

  it('una línea por gasto, con estado y diferencias traducidos', () => {
    const csv = buildReconciliationCsv(
      [
        row({
          state: 'difference',
          difference_kinds: ['amount_mismatch', 'support_without_expense'],
        }),
      ],
      labels,
    );
    expect(csv).toContain('"E:difference"');
    expect(csv).toContain('"K:amount_mismatch, K:support_without_expense"');
  });

  it('un título malicioso no queda como fórmula', () => {
    const csv = buildReconciliationCsv([row({ title: '=HYPERLINK("http://x")' })], labels);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).not.toContain(';"=HYPERLINK');
  });

  it('la justificación con comillas y punto y coma no rompe las columnas', () => {
    const csv = buildReconciliationCsv([row({ justification: 'Dijo "ok"; luego, nada' })], labels);
    expect(csv).toContain('"Dijo ""ok""; luego, nada"');
  });

  it('el monto del comprobante ausente queda vacío, no "0,00"', () => {
    const csv = buildReconciliationCsv([row({ receipt_amount: undefined })], labels);
    expect(csv.split('\r\n')[1]).toContain('"";"";"E:reconciled"');
  });
});
