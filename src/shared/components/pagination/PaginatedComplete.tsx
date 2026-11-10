import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { Select } from '@/shared/components/ui/select';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface Props {
  page: number;
  limit: number;
  total: number;
  links: { next: string | null; previous: string | null };
  onPageChange: (p: number) => void;
  /** Si se pasa, aparece el selector de cuántos registros mostrar. */
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
}

/** Páginas visibles: la primera, la última y las vecinas de la actual; el resto como `…`. */
export function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  const out: Array<number | 'gap'> = [];
  let last = 0;
  for (let p = 1; p <= totalPages; p++) {
    if (!keep.has(p)) continue;
    if (p - last > 1) out.push('gap');
    out.push(p);
    last = p;
  }
  return out;
}

export function PaginatedComplete({
  page,
  limit,
  total,
  links,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: Props) {
  const t = useT();
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const sizes = pageSizeOptions.includes(limit) ? pageSizeOptions : [...pageSizeOptions, limit].sort((a, b) => a - b);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t('list.showing', { from, to, total })}
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label={t('list.pagination')}>
          <button
            type="button"
            aria-label={t('list.previous')}
            disabled={!links.previous && page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
                className={cn(
                  'min-w-9 rounded px-3 py-1.5 text-sm hover:bg-muted',
                  p === page && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label={t('list.next')}
            disabled={!links.next && page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
      {onLimitChange && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('list.perPage')}
          <Select
            className="h-9 w-20"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
      )}
    </div>
  );
}
