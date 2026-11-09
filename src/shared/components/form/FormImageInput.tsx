import { useRef, useState } from 'react';
import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';

export type ImageVariant = 'avatar' | 'signature';

/**
 * Cada variante tiene su límite y su formato.
 *
 * La firma va en PNG y sin compresión con pérdida: el JPEG ensucia los trazos
 * finos con artefactos y una rúbrica mal leída no sirve como evidencia.
 */
const PRESETS: Record<ImageVariant, { maxSide: number; type: string; quality: number }> = {
  avatar: { maxSide: 256, type: 'image/jpeg', quality: 0.82 },
  signature: { maxSide: 600, type: 'image/png', quality: 1 },
};

/**
 * Reduce la imagen antes de enviarla. Sin esto, la foto de un teléfono viaja
 * como varios megas y termina guardada así para siempre.
 */
function shrinkToDataUrl(file: File, variant: ImageVariant): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('decode-failed'));
      image.onload = () => {
        const preset = PRESETS[variant];
        const scale = Math.min(1, preset.maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('no-canvas'));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(preset.type, preset.quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface Props<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  /** Iniciales a mostrar mientras no hay imagen. Solo en avatar. */
  fallback?: string;
  variant?: ImageVariant;
  /** Texto de ayuda bajo el control. */
  hint?: string;
  className?: string;
}

export function FormImageInput<T extends FieldValues>({
  name,
  label,
  fallback,
  variant = 'avatar',
  hint,
  className,
}: Props<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = typeof field.value === 'string' ? field.value : '';

        const pick = async (file: File | undefined) => {
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            setError(t('users.avatarOnlyImages'));
            return;
          }
          try {
            setError(null);
            field.onChange(await shrinkToDataUrl(file, variant));
          } catch {
            setError(t('users.avatarFailed'));
          }
        };

        return (
          <div className={className}>
            {label && <p className="mb-1.5 text-[13px] font-medium">{t(label)}</p>}

            <div className="flex items-center gap-3">
              <span
                className={
                  variant === 'signature'
                    ? // La rúbrica va sobre blanco siempre: en modo oscuro, un
                      // trazo negro sobre fondo oscuro no se vería.
                      'flex h-16 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white'
                    : 'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted'
                }
              >
                {value ? (
                  <img
                    src={value}
                    alt=""
                    className={
                      variant === 'signature'
                        ? 'max-h-full max-w-full object-contain'
                        : 'h-full w-full object-cover'
                    }
                  />
                ) : (
                  <span className="font-mono text-sm text-muted-foreground">
                    {variant === 'avatar' && fallback ? fallback : <ImagePlus className="h-5 w-5" />}
                  </span>
                )}
              </span>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  className="rounded-full border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {t(
                    variant === 'signature'
                      ? value
                        ? 'users.signatureChange'
                        : 'users.signatureAdd'
                      : value
                        ? 'users.avatarChange'
                        : 'users.avatarAdd',
                  )}
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => field.onChange('')}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>

            <input
              ref={ref}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                // Permite volver a elegir el mismo archivo tras borrarlo.
                e.target.value = '';
              }}
            />

            {hint && !error && <p className="mt-1.5 text-xs text-muted-foreground">{t(hint)}</p>}
            {error && <small className="mt-1 block text-destructive">{error}</small>}
          </div>
        );
      }}
    />
  );
}
