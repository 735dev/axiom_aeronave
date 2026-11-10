import { AttachmentImage } from '../components/AttachmentImage';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, FileWarning } from 'lucide-react';
import { getPendingReviews, PendingReview, validateAttachment } from '../api/ticketsApi';
import { ExtractedField } from '../types/ticket.types';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { useClientList } from '@/shared/hooks/useClientList';
import { CsvColumn } from '@/shared/utils/csv';
import { loadRows } from '@/shared/utils/fetchAllPages';
import { cn } from '@/shared/utils/cn';

/**
 * Consola de validación: la imagen y lo que el sistema leyó, lado a lado.
 *
 * Nada de lo extraído llega al expediente hasta que alguien lo aprueba acá.
 */
export function ReviewPage() {
  const t = useT();
  const [items, setItems] = useState<PendingReview[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setSaving] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  // La cola se revisa de a un comprobante: search y filtros recortan la cola, no hay páginas.
  const list = useClientList<PendingReview>({
    items,
    searchText: (r) => `${r.ticket_code} ${r.ticket_title} ${r.type_name} ${r.file.name} ${r.parent_code ?? ''}`,
    filters: { type: (r, v) => r.type_name === v },
  });
  const queue = list.filtered;
  const typeNames = [...new Set(items.map((r) => r.type_name))].sort();
  const filters: FilterDef[] = [
    {
      key: 'type',
      label: t('listData.ticketType'),
      type: 'select',
      options: typeNames.map((n) => ({ value: n, label: n })),
    },
  ];
  const columns: CsvColumn<PendingReview>[] = [
    { header: t('listData.csv.ticket'), value: (r) => r.ticket_code },
    { header: t('listData.csv.title'), value: (r) => r.ticket_title },
    { header: t('listData.csv.type'), value: (r) => r.type_name },
    { header: t('listData.csv.file'), value: (r) => r.file.name },
    { header: t('listData.csv.uploadedBy'), value: (r) => r.file.uploaded_by },
    { header: t('listData.csv.uploadedAt'), value: (r) => formatDateTime(r.file.uploaded_at) },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPendingReviews({ limit: 50 });
    if (res.ok) setItems(res.data.data);
    else notify.fromApiError(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = queue[current];

  // Al cambiar de comprobante se parte de lo leído, no de lo tipeado antes.
  useEffect(() => {
    if (!review) return;
    setSeen(new Set());
    setValues(
      Object.fromEntries(review.file.extraction?.fields.map((f) => [f.key, String(f.value)]) ?? []),
    );
  }, [review]);

  // Lo de baja confianza exige una acción: corregirlo o marcarlo como revisado.
  const unreviewed =
    review?.file.extraction?.fields.filter(
      (f) => f.confidence === 'low' && !seen.has(f.key) && values[f.key] === String(f.value),
    ) ?? [];

  const approve = async () => {
    if (!review || unreviewed.length > 0) return;
    setSaving(true);
    const res = await validateAttachment(
      review.ticket_id,
      review.file.id,
      Object.entries(values).map(([key, value]) => ({ key, value })),
      [...seen],
    );
    setSaving(false);
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    notify.toast.success(t('review.approved'));
    setCurrent(0);
    void load();
  };

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('review.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('review.subtitle')}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          <span className="data font-semibold text-foreground">{queue.length}</span>{' '}
          {t('review.pending')}
        </span>
      </header>

      {items.length > 0 && (
        <ListToolbar
          search={list.search}
          onSearch={(v) => {
            list.setSearch(v);
            setCurrent(0);
          }}
          searchPlaceholder={t('listData.searchReview')}
          filters={filters}
          values={list.values}
          onFilter={(k, v) => {
            list.setFilter(k, v);
            setCurrent(0);
          }}
          onClear={() => {
            list.clear();
            setCurrent(0);
          }}
          actions={
            <ExportButton
              filename={t('review.title')}
              columns={columns}
              load={loadRows(queue)}
              disabled={queue.length === 0}
            />
          }
        />
      )}

      {!review && items.length > 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('list.noResults')}</Card>
      )}

      {!review && items.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Check className="h-8 w-8 text-success" />
          <p className="font-medium">{t('review.empty')}</p>
          <p className="text-sm text-muted-foreground">{t('review.emptyHint')}</p>
        </Card>
      )}

      {review && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                to={`/tickets/${review.ticket_id}`}
                className="data text-lg font-medium text-primary hover:underline"
              >
                {review.ticket_code}
              </Link>
              <span className="label-strip">{review.type_name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{review.ticket_title}</p>

            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <AttachmentImage
                ticketId={review.ticket_id}
                fileId={review.file.id}
                name={review.file.name}
                zoom
                className="mx-auto max-h-[420px] w-auto object-contain"
              />
            </div>
            <p className="data text-xs text-muted-foreground">
              {review.file.name} · {formatDateTime(review.file.uploaded_at)} ·{' '}
              {review.file.uploaded_by}
            </p>
          </Card>

          <Card className="space-y-4 p-4">
            <div>
              <p className="label-strip">{t('review.extracted')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('review.extractedHint')}</p>
            </div>

            <div className="space-y-3">
              {review.file.extraction?.fields.map((field: ExtractedField) => (
                <div key={field.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[13px] font-medium">{field.label}</label>
                    <Badge variant={field.confidence === 'low' ? 'warning' : 'success'}>
                      {t(`review.confidence.${field.confidence}`)}
                    </Badge>
                  </div>
                  <Input
                    className={cn(
                      'data',
                      field.confidence === 'low' && 'border-warning bg-warning/5',
                    )}
                    value={values[field.key] ?? ''}
                    data-testid={`review-${field.key}`}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                  {field.confidence === 'low' && (
                    <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-warning">
                      <input
                        type="checkbox"
                        data-testid={`seen-${field.key}`}
                        checked={seen.has(field.key) || values[field.key] !== String(field.value)}
                        onChange={(e) =>
                          setSeen((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(field.key);
                            else next.delete(field.key);
                            return next;
                          })
                        }
                      />
                      {t('review.markSeen')}
                    </label>
                  )}
                </div>
              ))}
            </div>

            {review.file.extraction?.fields.some((f) => f.confidence === 'low') && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t('review.lowHint')}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void approve()}
                disabled={isSaving || unreviewed.length > 0}
                title={unreviewed.length > 0 ? t('review.mustReview') : undefined}
              >
                <Check className="h-4 w-4" />
                {t('review.approve')}
              </Button>
              {queue.length > 1 && (
                <Button variant="outline" onClick={() => setCurrent((c) => (c + 1) % queue.length)}>
                  {t('review.skip')}
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link to={`/tickets/${review.ticket_id}`}>
                  <FileWarning className="h-4 w-4" />
                  {t('review.openTicket')}
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
