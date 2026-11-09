import { useEffect, useRef, useState } from 'react';
import { IdCard, Plus, Trash2, UserRound } from 'lucide-react';
import { getPassengers, savePassengers } from '../api/ticketsApi';
import { Attachment, Passenger } from '../types/ticket.types';
import { attachPassport, manifestFiles } from '../passengers/passport';
import { AttachmentRejected, toAttachmentInput } from '../utils/prepareFile';
import { AttachmentImage } from './AttachmentImage';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

interface Props {
  ticketId: string;
  /** Valor inicial; la lista vigente se pide al servidor. */
  passengers?: Passenger[];
  /** Soportes de la operación: de ahí salen el manifiesto firmado y los pasaportes. */
  files?: Attachment[];
  readOnly?: boolean;
  onSaved: () => void;
}

/**
 * Manifiesto de pasajeros como dato, no como foto.
 *
 * La imagen del manifiesto firmado se sigue guardando entre los comprobantes;
 * esto es lo que permite responder en qué vuelos viajó una persona sin abrir
 * las fotos una por una.
 */
export function PassengersPanel({
  ticketId,
  passengers = [],
  files = [],
  readOnly,
  onSaved,
}: Props) {
  const t = useT();
  const [rows, setRows] = useState<Passenger[]>(passengers);
  const [isSaving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const passportInput = useRef<HTMLInputElement>(null);
  const passportTarget = useRef<number>(-1);
  const manifest = manifestFiles(files)[0];

  // El manifiesto es su propio recurso: no viene dentro del ticket. Lo que la persona ya empezó a
  // escribir no se pisa con una respuesta que llega tarde.
  const edited = useRef(false);
  useEffect(() => {
    let current = true;
    void getPassengers(ticketId).then((res) => {
      if (current && res.ok && !edited.current) setRows(res.data);
    });
    return () => {
      current = false;
    };
  }, [ticketId]);

  const passportOf = (p: Passenger) => files.find((f) => f.id === p.passport_file_id);

  const uploadPassport = async (file: File | undefined) => {
    const index = passportTarget.current;
    if (!file || index < 0) return;
    setUploadingIndex(index);
    try {
      const input = await toAttachmentInput(file);
      const res = await attachPassport({ id: ticketId, files }, rows, index, input);
      if (!res.ok) {
        notify.fromApiError(res);
        return;
      }
      // Sin esto la fila local no conoce el enlace y el siguiente "Guardar" lo borraría.
      setRows(res.data);
      notify.toast.success(t('passengers.passportSaved'));
      onSaved();
    } catch (e) {
      notify.toast.error(
        e instanceof AttachmentRejected ? t(e.messageKey, e.vars) : t('attachments.failed'),
      );
    } finally {
      setUploadingIndex(null);
    }
  };

  const manifestBlock = (
    <div className="mb-3 flex items-center gap-3" data-testid="manifest-block">
      {manifest ? (
        <AttachmentImage
          ticketId={ticketId}
          fileId={manifest.id}
          name={manifest.name}
          zoom
          className="h-16 w-16 rounded-md border border-border"
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        {manifest ? t('passengers.manifestSigned') : t('passengers.manifestMissing')}
      </p>
    </div>
  );

  const set = (index: number, patch: Partial<Passenger>) => {
    edited.current = true;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const add = () => {
    edited.current = true;
    setRows((prev) => [
      ...prev,
      { id: `nuevo-${prev.length + 1}`, full_name: '', document: '', nationality: '' },
    ]);
  };

  const save = async () => {
    const limpio = rows.filter((r) => r.full_name.trim() && r.document.trim());
    setSaving(true);
    const res = await savePassengers(ticketId, limpio);
    setSaving(false);
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    setRows(res.data);
    notify.toast.success(t('passengers.saved'));
    onSaved();
  };

  if (readOnly) {
    if (rows.length === 0) {
      return (
        <div>
          {manifestBlock}
          <p className="text-sm text-muted-foreground">{t('passengers.empty')}</p>
        </div>
      );
    }
    return (
      <div>
        {manifestBlock}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{p.full_name}</span>
              <span className="data text-xs text-muted-foreground">{p.document}</span>
              {passportOf(p) && (
                <AttachmentImage
                  ticketId={ticketId}
                  fileId={p.passport_file_id as string}
                  name={t('passengers.passport')}
                  zoom
                  className="h-10 w-10 rounded border border-border"
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {manifestBlock}
      <input
        ref={passportInput}
        data-testid="passport-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void uploadPassport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {rows.map((row, index) => (
        <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder={t('passengers.name')}
              value={row.full_name}
              onChange={(e) => set(index, { full_name: e.target.value })}
            />
            <Input
              className="data"
              placeholder={t('passengers.document')}
              value={row.document}
              onChange={(e) => set(index, { document: e.target.value })}
            />
            <Input
              placeholder={t('passengers.nationality')}
              value={row.nationality ?? ''}
              onChange={(e) => set(index, { nationality: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1">
            {passportOf(row) && (
              <AttachmentImage
                ticketId={ticketId}
                fileId={row.passport_file_id as string}
                name={t('passengers.passport')}
                zoom
                className="h-9 w-9 rounded border border-border"
              />
            )}
            <Button
              size="icon"
              variant="ghost"
              title={t('passengers.passport')}
              aria-label={t('passengers.passport')}
              disabled={uploadingIndex !== null || !row.full_name.trim() || !row.document.trim()}
              onClick={() => {
                passportTarget.current = index;
                passportInput.current?.click();
              }}
            >
              <IdCard className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                edited.current = true;
                setRows((prev) => prev.filter((_, i) => i !== index));
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
          {t('passengers.add')}
        </Button>
        <Button size="sm" disabled={isSaving} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('passengers.hint')}</p>
    </div>
  );
}
