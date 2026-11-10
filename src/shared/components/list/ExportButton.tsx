import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { CsvColumn, downloadCsv, toCsv } from '@/shared/utils/csv';
import { AllPagesResult, EXPORT_MAX_ROWS } from '@/shared/utils/fetchAllPages';

interface Props<T> {
  /** Nombre del archivo sin extensión; se le agrega la fecha. */
  filename: string;
  columns: CsvColumn<T>[];
  /** Trae las filas con los filtros actuales (p. ej. `() => fetchAllPages(getUsers, params)`). */
  load: () => Promise<AllPagesResult<T>>;
  disabled?: boolean;
}

export function ExportButton<T>({ filename, columns, load, disabled }: Props<T>) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await load();
      if (!res.ok) {
        notify.fromApiError(res);
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${filename}-${stamp}`, toCsv(columns, res.data.rows));
      if (res.data.truncated) notify.warning(t('list.exportTruncated', { max: EXPORT_MAX_ROWS }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => void run()}>
      <Download className="h-4 w-4" />
      {busy ? t('common.loading') : t('list.export')}
    </Button>
  );
}
