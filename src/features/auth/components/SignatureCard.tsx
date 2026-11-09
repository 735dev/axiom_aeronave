import { useEffect, useRef, useState } from 'react';
import { PenLine, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import {
  SIGNATURE_MAX_BYTES,
  SIGNATURE_MIME_TYPES,
  signatureProblem,
} from '@/shared/utils/signatureRules';
import { getMySignature, setMySignature } from '../api/signatureApi';

const PROBLEM_KEYS = { size: 'tooBig', type: 'badType', empty: 'empty' } as const;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Firma propia. La que respalda un cierre firmado es la de quien decide, así
 * que cada persona carga la suya: nadie puede subir la de otro.
 */
export function SignatureCard() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getMySignature().then((res) => {
      if (res.ok) setCurrent(res.data.signature_url);
    });
  }, []);

  const save = async (dataUrl: string | null) => {
    setBusy(true);
    const res = await setMySignature(dataUrl);
    setBusy(false);
    if (res.ok) {
      setCurrent(res.data.signature_url);
      notify.toast.success(t(dataUrl ? 'profile.signature.saved' : 'profile.signature.removed'));
      return;
    }
    notify.fromApiError(res);
  };

  const onPick = async (file?: File) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    // Mismo criterio que el servidor, para avisar sin viajar; el servidor igual lo repite.
    const problem = signatureProblem(file.type, file.size);
    if (problem) {
      notify.toast.error(
        t(`profile.signature.${PROBLEM_KEYS[problem]}`, { kb: SIGNATURE_MAX_BYTES / 1024 }),
      );
      return;
    }
    await save(await readAsDataUrl(file));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
          <PenLine className="h-4 w-4" />
          {t('profile.signature.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border bg-white p-2">
          {current ? (
            <img
              src={current}
              alt={t('profile.signature.title')}
              data-testid="signature-preview"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-neutral-500" data-testid="signature-empty">
              {t('profile.signature.none')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={SIGNATURE_MIME_TYPES.join(',')}
            className="hidden"
            data-testid="signature-input"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t(current ? 'profile.signature.replace' : 'profile.signature.upload')}
          </Button>
          {current && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              data-testid="signature-remove"
              onClick={() => void save(null)}
            >
              <Trash2 className="h-4 w-4" />
              {t('profile.signature.remove')}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('profile.signature.hint', { kb: SIGNATURE_MAX_BYTES / 1024 })}
        </p>
      </CardContent>
    </Card>
  );
}
