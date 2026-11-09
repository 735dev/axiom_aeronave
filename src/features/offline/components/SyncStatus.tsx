import { useState } from 'react';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import { useOfflineSync } from '../hooks/useOfflineSync';

/**
 * Qué quedó sin enviar. Aparece solo cuando hay algo: si todo llegó, no ocupa
 * lugar. Lo rechazado por el servidor se muestra aparte y no se descarta solo.
 */
export function SyncStatus() {
  const t = useT();
  const { items, isSyncing, online, flush, retryFailed, discard } = useOfflineSync();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;
  const failed = items.filter((i) => i.state === 'failed');

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('gap-1.5', failed.length > 0 && 'text-destructive')}
        aria-label={t('offline.title')}
      >
        {failed.length > 0 ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <CloudOff className={cn('h-4 w-4', isSyncing && 'animate-pulse')} />
        )}
        <span className="data text-xs">{items.length}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('offline.title')}</DialogTitle>
          </DialogHeader>
          <p className="pt-2 text-sm text-muted-foreground">{t('offline.hint')}</p>

          <ul className="space-y-2 pt-4">
            {items.map((item) => (
              <li key={item.key} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="data text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                      {item.attempts > 0 && ` · ${t('offline.attempts', { count: item.attempts })}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-medium',
                      item.state === 'failed' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {item.state === 'failed' ? t('offline.failed') : t('offline.waiting')}
                  </span>
                </div>
                {item.state === 'failed' && (
                  <>
                    {item.error && <p className="pt-1 text-xs text-destructive">{item.error}</p>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => void discard(item.key)}
                    >
                      {t('offline.discard')}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-4">
            <Button className="flex-1" disabled={isSyncing || !online} onClick={() => void flush()}>
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              {t('offline.sendNow')}
            </Button>
            {failed.length > 0 && (
              <Button variant="outline" onClick={() => void retryFailed()}>
                {t('offline.retryFailed')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
