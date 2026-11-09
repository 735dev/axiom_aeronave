import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface Props {
  page: number;
  limit: number;
  total: number;
  links: { next: string | null; previous: string | null };
  onPageChange: (p: number) => void;
}

export function PaginatedComplete({ page, limit, total, links, onPageChange }: Props) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages === 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={!links.previous}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="rounded p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={cn(
            'min-w-9 rounded px-3 py-1.5 text-sm hover:bg-muted',
            p === page && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={!links.next}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="rounded p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
