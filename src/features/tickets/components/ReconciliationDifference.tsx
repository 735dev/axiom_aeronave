import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Difference } from '../types/reconciliation.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Can } from '@/shared/components/auth/Can';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/shared/store/hooks';
import { formatDateTime } from '@/shared/utils/formatters';

const SEVERITY_VARIANT = { high: 'danger', medium: 'warning', low: 'default' } as const;

function amountText(amount?: number, currency?: string): string {
  if (amount === undefined) return '';
  return `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(amount)} ${currency ?? ''}`.trim();
}

interface Props {
  difference: Difference;
  /** Un período cerrado ya no admite justificar nada. */
  locked: boolean;
  onJustify: (key: string, note: string) => Promise<void>;
}

/** Una diferencia con su explicación y, si falta, el campo para justificarla. */
export function ReconciliationDifference({ difference: d, locked, onJustify }: Props) {
  const t = useT();
  const lang = useAppSelector((s) => s.lang.current);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const tooShort = note.trim().length < 5;

  const explanation = t(`reconciliation.reason.${d.reason}`, {
    code: d.ticket_code,
    file: d.file_name ?? '',
    receipt: amountText(d.receipt_amount, d.receipt_currency),
    expense: amountText(d.expense_amount, d.expense_currency),
  });

  const submit = async () => {
    setSaving(true);
    await onJustify(d.key, note.trim());
    setSaving(false);
    setNote('');
  };

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_VARIANT[d.severity]}>
          {t(`reconciliation.severity.${d.severity}`)}
        </Badge>
        <span className="text-sm font-semibold">{t(`reconciliation.kind.${d.kind}`)}</span>
        <Link to={`/tickets/${d.ticket_id}`} className="data text-sm text-primary hover:underline">
          {d.ticket_code}
        </Link>
        {d.operation_code && (
          <span className="data text-xs text-muted-foreground">{d.operation_code}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{explanation}</p>

      {d.acknowledgement ? (
        <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
          {t('reconciliation.justify.by', {
            name: d.acknowledgement.actor_name,
            date: formatDateTime(d.acknowledgement.at, lang),
            note: d.acknowledgement.note,
          })}
        </p>
      ) : (
        !locked && (
          <Can permission={PERMISSIONS.reconciliationClose}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                value={note}
                placeholder={t('reconciliation.justify.placeholder')}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button size="sm" variant="outline" disabled={tooShort || saving} onClick={submit}>
                {t('reconciliation.justify.save')}
              </Button>
            </div>
          </Can>
        )
      )}
    </li>
  );
}
