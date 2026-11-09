import {
  DifferenceKind,
  ReconciliationRow,
  ReconciliationRowState,
} from '../types/reconciliation.types';

/** Separador de Excel en configuración regional española: la coma es el decimal. */
export const CSV_SEPARATOR = ';';
const BOM = '﻿';

/**
 * Una celda que empieza con = + - @ (o tabulación/retorno) la interpreta Excel
 * como fórmula. Un título de gasto escrito por un usuario no puede ejecutar
 * nada en la computadora de quien abre el archivo: se antepone una comilla.
 */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Toda celda va entre comillas, con las comillas internas duplicadas. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  // Un número se formatea con coma decimal y no pasa por el guard: "-5" es un
  // monto legítimo, no una fórmula.
  const text =
    typeof value === 'number' ? value.toFixed(2).replace('.', ',') : neutralizeFormula(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export interface CsvLabels {
  headers: string[];
  state: (state: ReconciliationRowState) => string;
  kind: (kind: DifferenceKind) => string;
}

/** Arma el CSV del detalle conciliado: UTF-8 con BOM para que Excel respete los acentos. */
export function buildReconciliationCsv(rows: ReconciliationRow[], labels: CsvLabels): string {
  const lines = [labels.headers.map(csvCell).join(CSV_SEPARATOR)];
  rows.forEach((r) => {
    lines.push(
      [
        csvCell(r.code),
        csvCell(r.operation_code),
        csvCell(r.title),
        csvCell(r.concept),
        csvCell(r.date),
        csvCell(r.status_name),
        csvCell(r.amount),
        csvCell(r.currency),
        csvCell(r.amount_base),
        csvCell(String(r.validated_receipts)),
        csvCell(r.receipt_amount ?? null),
        csvCell(r.receipt_currency ?? ''),
        csvCell(labels.state(r.state)),
        csvCell(r.difference_kinds.map(labels.kind).join(', ')),
        csvCell(r.justification ?? ''),
      ].join(CSV_SEPARATOR),
    );
  });
  return BOM + lines.join('\r\n') + '\r\n';
}

/** Entrega el texto como descarga del navegador. */
export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
