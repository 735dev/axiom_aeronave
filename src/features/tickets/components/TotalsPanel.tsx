import { ExpenseTotals } from '../types/ticket.types';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

interface Props {
  totals: ExpenseTotals;
  className?: string;
}

/**
 * Confirmado, en curso y excluido se muestran por separado a propósito:
 * un total único obligaría a confiar en un criterio que no se ve.
 */
export function TotalsPanel({ totals, className }: Props) {
  const t = useT();
  const base = totals.base_currency;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <p className="label-strip">{t('totals.committed')}</p>
          <p className="data mt-1 text-lg font-semibold">
            {money(totals.committed_base, base)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <p className="label-strip">{t('totals.pending')}</p>
          <p className="data mt-1 text-lg font-semibold text-warning">
            {money(totals.pending_base, base)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/60 p-3">
          <p className="label-strip">{t('totals.excluded')}</p>
          <p className="data mt-1 text-lg font-semibold text-muted-foreground">
            {money(totals.excluded_base, base)}
          </p>
        </div>
      </div>

      {totals.by_currency.length > 0 && (
        <div>
          <p className="label-strip mb-1.5">{t('totals.byCurrency')}</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {totals.by_currency.map((row) => (
              <li
                key={row.currency}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {row.currency_name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    <span className="data">{row.count}</span> {t('totals.records')}
                  </span>
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="data">{money(row.amount, row.currency)}</span>
                  {row.currency !== base && (
                    <span className="data text-xs text-muted-foreground">
                      = {money(row.amount_base, base)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totals.by_concept.length > 0 && (
        <div>
          <p className="label-strip mb-1.5">{t('totals.byConcept')}</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {totals.by_concept.map((row) => {
              const share =
                totals.committed_base + totals.pending_base > 0
                  ? (row.amount_base / (totals.committed_base + totals.pending_base)) * 100
                  : 0;
              return (
                <li key={row.key} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>{row.label}</span>
                    <span className="data">{money(row.amount_base, base)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
