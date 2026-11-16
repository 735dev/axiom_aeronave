import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { CsvColumn } from '@/shared/utils/csv';
import { AllPagesResult, EXPORT_MAX_ROWS } from '@/shared/utils/fetchAllPages';
import { Celda, HojaPlanilla, downloadPlanilla } from '@/shared/utils/planilla';

export interface ExportFigure {
  label: string;
  value: Celda;
}

interface Props<T> {
  /** Nombre del archivo sin extensión; se le agrega la fecha. */
  filename: string;
  /** Título del PDF y del diálogo. Si falta, se usa el nombre del archivo. */
  title?: string;
  columns: CsvColumn<T>[];
  /** Cifras que ya se ven en la pantalla y no son una columna. */
  figures?: ExportFigure[];
  /** Trae las filas con los filtros actuales (p. ej. `() => fetchAllPages(getUsers, params)`). */
  load: () => Promise<AllPagesResult<T>>;
  disabled?: boolean;
  /** Después de entregar el archivo. La conciliación deja constancia en la bitácora. */
  onDone?: () => void | Promise<void>;
}

function cell(value: string | number | boolean | null | undefined): Celda {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value;
}

export function hojasDeExportacion<T>(
  columns: CsvColumn<T>[],
  figures: ExportFigure[],
  rows: T[],
  picked: string[],
): HojaPlanilla[] {
  const chosen = new Set(picked);
  const hojas: HojaPlanilla[] = [];
  const cifras = figures.filter((_, index) => chosen.has(`f${index}`));
  if (cifras.length) {
    hojas.push({
      nombre: 'Cifras',
      columnas: ['Indicador', 'Valor'],
      filas: cifras.map((figure) => [figure.label, figure.value]),
    });
  }
  const cols = columns.filter((_, index) => chosen.has(`c${index}`));
  if (cols.length) {
    hojas.push({
      nombre: 'Listado',
      columnas: cols.map((column) => column.header),
      filas: rows.map((row) => cols.map((column) => cell(column.value(row)))),
    });
  }
  return hojas;
}

export function ExportButton<T>({
  filename,
  title,
  columns,
  figures = [],
  load,
  disabled,
  onDone,
}: Props<T>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () => [
      ...figures.map((figure, index) => ({
        id: `f${index}`,
        label: figure.label,
        origen: 'calculado' as const,
      })),
      ...columns.map((column, index) => ({
        id: `c${index}`,
        label: column.header,
        origen: column.origen === 'calculado' ? ('calculado' as const) : ('tabla' as const),
      })),
    ],
    [columns, figures],
  );

  const openDialog = () => {
    setPicked(fields.map((field) => field.id));
    setError(null);
    setOpen(true);
  };

  const selected = useMemo(() => new Set(picked), [picked]);
  const calculated = fields.filter((field) => field.origen === 'calculado');
  const table = fields.filter((field) => field.origen !== 'calculado');

  const toggle = (id: string, on: boolean) => {
    setPicked((current) => (on ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
  };

  const toggleGroup = (ids: string[], on: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return [...next];
    });
  };

  const run = async (format: 'pdf' | 'xlsx') => {
    if (picked.length === 0) {
      setError(t('list.exportPick.needOne'));
      return;
    }
    setBusy(format);
    setError(null);
    try {
      const res = await load();
      if (!res.ok) {
        notify.fromApiError(res);
        return;
      }
      const hojas = hojasDeExportacion(columns, figures, res.data.rows, picked);
      if (!hojas.length) {
        setError(t('list.exportPick.needOne'));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const heading = title ?? filename;
      downloadPlanilla(`${filename}-${stamp}`, format, heading, hojas);
      if (res.data.truncated) notify.warning(t('list.exportTruncated', { max: EXPORT_MAX_ROWS }));
      await onDone?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('list.exportPick.needOne'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled || !!busy} onClick={openDialog}>
        <Download className="h-4 w-4" />
        {t('list.export')}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{title ?? t('list.export')}</DialogTitle>
          <DialogDescription>{t('list.exportPick.subtitle')}</DialogDescription>
          {fields.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{t('list.exportPick.empty')}</p>}
          <FieldGroup
            title={t('list.exportPick.calculated')}
            hint={t('list.exportPick.calculatedHint')}
            fields={calculated}
            selected={selected}
            allLabel={t('list.exportPick.all')}
            onToggle={toggle}
            onToggleAll={toggleGroup}
          />
          <FieldGroup
            title={t('list.exportPick.columns')}
            hint={t('list.exportPick.columnsHint')}
            fields={table}
            selected={selected}
            allLabel={t('list.exportPick.all')}
            onToggle={toggle}
            onToggleAll={toggleGroup}
          />
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!!busy || picked.length === 0} onClick={() => void run('pdf')}>
              <Download className="h-4 w-4" />
              {busy === 'pdf' ? t('common.loading') : t('list.exportPick.pdf')}
            </Button>
            <Button type="button" size="sm" disabled={!!busy || picked.length === 0} onClick={() => void run('xlsx')}>
              <Download className="h-4 w-4" />
              {busy === 'xlsx' ? t('common.loading') : t('list.exportPick.excel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FieldGroup({
  title,
  hint,
  fields,
  selected,
  allLabel,
  onToggle,
  onToggleAll,
}: {
  title: string;
  hint: string;
  fields: { id: string; label: string }[];
  selected: Set<string>;
  allLabel: string;
  onToggle: (id: string, on: boolean) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
}) {
  if (!fields.length) return null;
  const ids = fields.map((field) => field.id);
  const all = ids.every((id) => selected.has(id));
  return (
    <fieldset className="mt-4 rounded-md border border-border px-3 py-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={all} onChange={(event) => onToggleAll(ids, event.target.checked)} />
        {allLabel}
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(field.id)}
              onChange={(event) => onToggle(field.id, event.target.checked)}
            />
            {field.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
