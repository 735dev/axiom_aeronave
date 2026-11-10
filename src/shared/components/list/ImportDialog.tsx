import { ChangeEvent, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ApiResult } from '@/shared/api/types';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { downloadCsv, parseCsvObjects } from '@/shared/utils/csv';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  ImportResult,
  PreparedImport,
  describeRowError,
  prepareImport,
  templateCsv,
} from '@/shared/utils/importRows';

interface Props {
  title: string;
  /** Cabeceras de la plantilla, en orden. */
  columns: string[];
  /** Cabeceras sin las que el archivo no sirve. */
  required: string[];
  templateName: string;
  /** Envía las filas al servidor. `dryRun` valida sin escribir nada. */
  run: (rows: Record<string, string>[], dryRun: boolean) => Promise<ApiResult<ImportResult>>;
  /** Se llama tras importar de verdad, para recargar la lista. */
  onDone: () => void;
}

const PREVIEW_ROWS = 10;

/** Importar desde CSV en dos pasos: validar (sin escribir) y recién entonces importar. */
export function ImportDialog({ title, columns, required, templateName, run, onDone }: Props) {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName('');
    setPrepared(null);
    setResult(null);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) reset();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setPrepared(null);
      notify.warning(t('list.import.tooBig'));
      return;
    }
    setFileName(file.name);
    setPrepared(prepareImport(parseCsvObjects(await file.text()), columns, required));
  };

  const send = async (dryRun: boolean) => {
    if (!prepared || prepared.problem) return;
    setBusy(true);
    const res = await run(prepared.rows, dryRun);
    setBusy(false);
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    setResult(res.data);
    if (!dryRun && res.data.errors.length === 0) {
      notify.toast.success(t('list.import.done', { created: res.data.created, updated: res.data.updated }));
      onDone();
      onOpenChange(false);
    }
  };

  const problemText = (() => {
    const p = prepared?.problem;
    if (!p) return '';
    if (p.code === 'empty') return t('list.import.empty');
    if (p.code === 'tooMany') return t('list.import.tooMany', { max: p.max, total: p.total });
    return t('list.import.missingColumns', { columns: p.columns.join(', ') });
  })();

  const rows = prepared?.rows ?? [];
  const clean = result?.dry_run === true && result.errors.length === 0;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        {t('list.import.button')}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {t('list.import.hint', { columns: columns.join(', '), max: IMPORT_MAX_ROWS })}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadCsv(templateName, templateCsv(columns))}
              >
                <Download className="h-4 w-4" />
                {t('list.import.template')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                aria-label={t('list.import.pick')}
                onChange={(e) => void onFile(e)}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
              />
            </div>

            {prepared?.problem && (
              <p role="alert" className="text-sm text-destructive">
                {problemText}
              </p>
            )}
            {prepared && !prepared.problem && prepared.ignored.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('list.import.ignored', { columns: prepared.ignored.join(', ') })}
              </p>
            )}

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {fileName} · {t('list.import.rows', { total: rows.length })}
                </p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5">#</th>
                        {columns.map((c) => (
                          <th key={c} className="px-2 py-1.5 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          {columns.map((c) => (
                            <td key={c} className="max-w-48 truncate px-2 py-1.5">
                              {r[c]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > PREVIEW_ROWS && (
                  <p className="text-xs text-muted-foreground">
                    {t('list.import.previewMore', { shown: PREVIEW_ROWS, total: rows.length })}
                  </p>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-2" aria-live="polite">
                <p className="text-sm">
                  {result.dry_run
                    ? t('list.import.validated', {
                        total: result.total,
                        created: result.created,
                        updated: result.updated,
                        skipped: result.skipped,
                      })
                    : t('list.import.failedCommit')}
                </p>
                {result.errors.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-destructive/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5">{t('list.import.errRow')}</th>
                          <th className="px-2 py-1.5">{t('list.import.errField')}</th>
                          <th className="px-2 py-1.5">{t('list.import.errMessage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i} className="border-t border-border" title={describeRowError(e)}>
                            <td className="px-2 py-1.5">{e.row}</td>
                            <td className="px-2 py-1.5">{e.field}</td>
                            <td className="px-2 py-1.5">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || rows.length === 0 || Boolean(prepared?.problem)}
                onClick={() => void send(true)}
              >
                {t('list.import.validate')}
              </Button>
              <Button type="button" disabled={busy || !clean} onClick={() => void send(false)}>
                {t('list.import.run')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
