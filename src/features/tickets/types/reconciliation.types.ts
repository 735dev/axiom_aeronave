/** Las tres diferencias que la conciliación señala (Alcance §6.18). */
export type DifferenceKind =
  'expense_without_support' | 'support_without_expense' | 'amount_mismatch';

export type DifferenceSeverity = 'high' | 'medium' | 'low';

/** Motivo concreto; la explicación se arma en el cliente con i18n. */
export type DifferenceReason =
  'no_files' | 'unvalidated' | 'discarded_expense' | 'no_matching_expense' | 'amount' | 'currency';

/** Justificación de quien aceptó una diferencia para poder cerrar el período. */
export interface Acknowledgement {
  note: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  at: string;
}

export interface Difference {
  /** Estable entre consultas: `tipo:gasto:archivo`. Sirve para justificarla. */
  key: string;
  kind: DifferenceKind;
  severity: DifferenceSeverity;
  reason: DifferenceReason;
  ticket_id: string;
  ticket_code: string;
  operation_code?: string;
  file_id?: string;
  file_name?: string;
  expense_amount?: number;
  expense_currency?: string;
  receipt_amount?: number;
  receipt_currency?: string;
  acknowledgement?: Acknowledgement;
}

export type ReconciliationRowState = 'reconciled' | 'difference' | 'discarded';

/** Una línea del detalle conciliado: lo que se exporta. */
export interface ReconciliationRow {
  ticket_id: string;
  code: string;
  operation_code: string;
  title: string;
  concept: string;
  date: string;
  status_name: string;
  amount: number;
  currency: string;
  amount_base: number;
  base_currency: string;
  validated_receipts: number;
  receipt_amount?: number;
  receipt_currency?: string;
  state: ReconciliationRowState;
  difference_kinds: DifferenceKind[];
  justification?: string;
}

export interface ClosedPeriod {
  period: string;
  closed_at: string;
  closed_by_id: string;
  closed_by_name: string;
  closed_by_role: string;
  rows_count: number;
  total_base: number;
  acknowledged_count: number;
}

export interface ReconciliationReport {
  period: string;
  from: string;
  to: string;
  base_currency: string;
  rows: ReconciliationRow[];
  differences: Difference[];
  open_differences: number;
  totals: { reconciled_base: number; difference_base: number; discarded_base: number };
  close: ClosedPeriod | null;
}
