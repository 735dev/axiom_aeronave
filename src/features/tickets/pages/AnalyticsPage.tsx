import { useMemo, useState } from 'react';
import { useTicketTotals, useTicketTypes } from '../hooks/useTickets';
import { TotalsPanel } from '../components/TotalsPanel';
import { TotalsQuery } from '../api/ticketsApi';
import { Card } from '@/shared/components/ui/card';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';

/** Primer y último día del mes en curso, en formato `YYYY-MM-DD`. */
function currentMonth(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const last = new Date(year, now.getMonth() + 1, 0).getDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${pad(last)}` };
}

export function AnalyticsPage() {
  const t = useT();
  const { types } = useTicketTypes();
  const month = useMemo(currentMonth, []);
  const [draft, setDraft] = useState<TotalsQuery>({ ...month });
  const [applied, setApplied] = useState<TotalsQuery>({ ...month });
  const { totals, isLoading } = useTicketTotals(applied);

  // Solo los tipos que tienen un campo de importe pueden totalizarse.
  const valuedTypes = types.filter((type) => type.fields.some((f) => f.role === 'amount'));

  const set = (patch: Partial<TotalsQuery>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1.5">{t('analytics.from')}</Label>
            <Input
              type="date"
              value={draft.from ?? ''}
              onChange={(e) => set({ from: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label className="mb-1.5">{t('analytics.to')}</Label>
            <Input
              type="date"
              value={draft.to ?? ''}
              onChange={(e) => set({ to: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label className="mb-1.5">{t('analytics.type')}</Label>
            <Select
              value={draft.type_code ?? ''}
              onChange={(e) => set({ type_code: e.target.value || undefined })}
            >
              <option value="">{t('common.all')}</option>
              {valuedTypes.map((type) => (
                <option key={type.id} value={type.code}>
                  {type.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => setApplied(draft)}>
              {t('analytics.apply')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({ ...month });
                setApplied({ ...month });
              }}
            >
              {t('analytics.thisMonth')}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('analytics.dateHint')}</p>
      </Card>

      <Card className="p-4">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {!isLoading && totals && <TotalsPanel totals={totals} />}
        {!isLoading && !totals && (
          <p className="text-sm text-muted-foreground">{t('analytics.empty')}</p>
        )}
      </Card>
    </section>
  );
}
