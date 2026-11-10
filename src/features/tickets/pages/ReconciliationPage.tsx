import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import {
  acknowledgeDifference,
  closeReconciliationPeriod,
  getClosedPeriods,
  getReconciliation,
  recordReconciliationExport,
} from '../api/reconciliationApi';
import { ClosedPeriod, ReconciliationReport, ReconciliationRow, ReconciliationRowState } from '../types/reconciliation.types';
import { ReconciliationDifference } from '../components/ReconciliationDifference';
import { buildReconciliationCsv, downloadCsv } from '../utils/reconciliationCsv';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Can } from '@/shared/components/auth/Can';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/shared/store/hooks';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ClientPagination } from '@/shared/components/list/ClientPagination';
import { DataTable, Column } from '@/shared/components/list/DataTable';
import { useClientList } from '@/shared/hooks/useClientList';

const ROW_VARIANT: Record<ReconciliationRowState, 'success' | 'danger' | 'default'> = {
  reconciled: 'success',
  difference: 'danger',
  discarded: 'default',
};

const EMPTY_ROWS: ReconciliationRow[] = [];

function money(value: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(value);
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Cruce entre lo gastado y lo respaldado, para cerrar el período. */
export function ReconciliationPage() {
  const t = useT();
  const lang = useAppSelector((s) => s.lang.current);
  const [draft, setDraft] = useState(currentPeriod);
  const [period, setPeriod] = useState(draft);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isBusy, setBusy] = useState(false);
  const [periods, setPeriods] = useState<ClosedPeriod[]>([]);

  const loadPeriods = useCallback(async () => {
    const res = await getClosedPeriods();
    if (res.ok) setPeriods(res.data);
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getReconciliation(period);
    if (res.ok) setReport(res.data);
    else notify.fromApiError(res);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsList = useClientList<ReconciliationRow>({
    items: report?.rows ?? EMPTY_ROWS,
    searchText: (r) => `${r.code} ${r.title} ${r.operation_code ?? ''}`,
    filters: {
      state: (r, v) => r.state === v,
      currency: (r, v) => r.currency === v,
    },
  });
  const rowFilters: FilterDef[] = [
    {
      key: 'state',
      label: t('listData.rowState'),
      type: 'select',
      options: (['reconciled', 'difference', 'discarded'] as const).map((s) => ({
        value: s,
        label: t(`reconciliation.state.${s}`),
      })),
    },
    {
      key: 'currency',
      label: t('listData.currency'),
      type: 'select',
      options: [...new Set((report?.rows ?? []).map((r) => r.currency))]
        .sort()
        .map((c) => ({ value: c, label: c })),
    },
  ];

  const closed = report?.close ?? null;
  const base = report?.base_currency ?? 'USD';
  const discardedCount = useMemo(
    () => report?.rows.filter((r) => r.state === 'discarded').length ?? 0,
    [report],
  );

  const justify = async (key: string, note: string) => {
    const res = await acknowledgeDifference(period, key, note);
    if (res.ok) {
      setReport(res.data);
      notify.toast.success(t('reconciliation.justify.saved'));
    } else notify.fromApiError(res);
  };

  const close = () => {
    notify.confirm(t('reconciliation.close.confirm', { period }), async () => {
      setBusy(true);
      const res = await closeReconciliationPeriod(period);
      setBusy(false);
      if (res.ok) {
        setReport(res.data);
        void loadPeriods();
        notify.toast.success(t('reconciliation.close.done'));
      } else notify.fromApiError(res);
    });
  };

  const exportCsv = async () => {
    if (!report) return;
    const csv = buildReconciliationCsv(report.rows, {
      headers: [
        'code',
        'operation',
        'title',
        'concept',
        'date',
        'status',
        'amount',
        'currency',
        'amount_base',
        'receipts',
        'receipt_amount',
        'receipt_currency',
        'state',
        'differences',
        'justification',
      ].map((k) => t(`reconciliation.csv.${k}`)),
      state: (s) => t(`reconciliation.state.${s}`),
      kind: (k) => t(`reconciliation.kind.${k}`),
    });
    downloadCsv(t('reconciliation.export.file', { period }), csv);
    // Llevarse el detalle es un hecho que la bitácora debe poder probar.
    const res = await recordReconciliationExport(period);
    if (res.ok) notify.toast.success(t('reconciliation.export.done'));
    else notify.fromApiError(res);
  };

  const summary = (label: string, value: number, tone: string) => (
    <div className="rounded-lg border border-border bg-muted/60 p-3">
      <p className="label-strip">{label}</p>
      <p className={`data mt-1 text-lg font-semibold ${tone}`}>
        {money(value)} {base}
      </p>
    </div>
  );

  const rowColumns: Column<ReconciliationRow>[] = [
    {
      key: 'code',
      header: 'listData.csv.code',
      primary: true,
      cell: (r) => (
        <Link to={`/tickets/${r.ticket_id}`} className="data text-sm text-primary hover:underline">
          {r.code}
        </Link>
      ),
    },
    {
      key: 'state',
      header: 'listData.csv.status',
      cell: (r) => <Badge variant={ROW_VARIANT[r.state]}>{t(`reconciliation.state.${r.state}`)}</Badge>,
    },
    { key: 'title', header: 'listData.csv.title', cell: (r) => <span className="text-sm text-muted-foreground">{r.title}</span> },
    {
      key: 'operation',
      header: 'listData.csv.operation',
      cell: (r) => (r.operation_code ? <span className="data text-xs text-muted-foreground">{r.operation_code}</span> : '—'),
    },
    {
      key: 'amount',
      header: 'listData.csv.amount',
      align: 'right',
      cell: (r) => (
        <span className="data text-sm">
          {money(r.amount)} {r.currency}
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t('reconciliation.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('reconciliation.subtitle')}</p>
      </header>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5">{t('reconciliation.period')}</Label>
            <Input type="month" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button size="sm" disabled={!draft} onClick={() => setPeriod(draft)}>
              {t('reconciliation.apply')}
            </Button>
          </div>
        </div>
      </Card>

      {periods.length > 0 && (
        <Card className="p-4" data-testid="closed-periods">
          <p className="label-strip">{t('reconciliation.closedPeriods')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p.period}
                type="button"
                className="data rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => {
                  setDraft(p.period);
                  setPeriod(p.period);
                }}
              >
                {p.period}
              </button>
            ))}
          </div>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      {closed && (
        <Card className="space-y-1 border-success p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4 text-success" />
            {t('reconciliation.close.banner', {
              name: closed.closed_by_name,
              date: formatDateTime(closed.closed_at, lang),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('reconciliation.close.summary', {
              rows: closed.rows_count,
              total: `${money(closed.total_base)} ${base}`,
              ack: closed.acknowledged_count,
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t('reconciliation.close.why')}</p>
        </Card>
      )}

      {!isLoading && report && report.rows.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('reconciliation.empty')}
        </Card>
      )}

      {!isLoading && report && report.rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {summary(
              t('reconciliation.conciliated'),
              report.totals.reconciled_base,
              'text-success',
            )}
            {summary(
              t('reconciliation.withDifferences'),
              report.totals.difference_base,
              'text-destructive',
            )}
            {summary(
              t('reconciliation.discardedTotal'),
              report.totals.discarded_base,
              'text-muted-foreground',
            )}
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="label-strip">{t('reconciliation.differencesTitle')}</p>
              {report.open_differences > 0 && (
                <Badge variant="danger">
                  {t('reconciliation.openCount', { count: report.open_differences })}
                </Badge>
              )}
            </div>
            {report.differences.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t('reconciliation.noDifferences')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {report.differences.map((d) => (
                  <ReconciliationDifference
                    key={d.key}
                    difference={d}
                    locked={Boolean(closed)}
                    onJustify={justify}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="label-strip">{t('reconciliation.detailTitle')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="mr-1.5 h-4 w-4" />
                  {t('reconciliation.export.action')}
                </Button>
                {!closed && (
                  <Can permission={PERMISSIONS.reconciliationClose}>
                    <Button
                      size="sm"
                      disabled={isBusy || report.open_differences > 0}
                      onClick={close}
                    >
                      {t('reconciliation.close.action')}
                    </Button>
                  </Can>
                )}
              </div>
            </div>
            {!closed && report.open_differences > 0 && (
              <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                {t('reconciliation.close.blocked', { count: report.open_differences })}
              </p>
            )}
            <div className="border-b border-border px-4 py-3">
              <ListToolbar
                search={rowsList.search}
                onSearch={rowsList.setSearch}
                searchPlaceholder={t('listData.searchReconciliation')}
                filters={rowFilters}
                values={rowsList.values}
                onFilter={rowsList.setFilter}
                onClear={rowsList.clear}
              />
            </div>
            <div className="p-4">
              <DataTable
                columns={rowColumns}
                rows={rowsList.rows}
                rowKey={(r) => r.ticket_id}
                emptyMessage="list.noResults"
              />
            </div>
            <div className="px-4 py-3">
              <ClientPagination list={rowsList} />
            </div>
          </Card>

          {discardedCount > 0 && (
            <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
              {t('reconciliation.discarded', { count: String(discardedCount) })}
            </p>
          )}

          <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            {t('reconciliation.note')}
          </p>
        </>
      )}
    </section>
  );
}
