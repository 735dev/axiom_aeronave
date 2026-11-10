import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterDef =
  | { key: string; label: string; type: 'select'; options: FilterOption[] }
  | { key: string; label: string; type: 'date' };

interface Props {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  values?: Record<string, string>;
  onFilter?: (key: string, value: string) => void;
  onClear?: () => void;
  /** Exportar, importar y demás acciones de la lista. */
  actions?: ReactNode;
}

/** Search + filtros + acciones de una lista. No sabe de dónde salen los datos. */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder,
  filters = [],
  values = {},
  onFilter,
  onClear,
  actions,
}: Props) {
  const t = useT();
  const active = filters.some((f) => (values[f.key] ?? '') !== '') || Boolean(search);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onSearch && (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              type="search"
              aria-label={t('common.search')}
              placeholder={searchPlaceholder ?? t('common.search')}
              value={search ?? ''}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          {filters.map((f) => (
            <label key={f.key} className="flex min-w-36 flex-col gap-1 text-xs font-medium text-muted-foreground">
              {f.label}
              {f.type === 'select' ? (
                <Select
                  className="h-9"
                  value={values[f.key] ?? ''}
                  onChange={(e) => onFilter?.(f.key, e.target.value)}
                >
                  <option value="">{t('common.all')}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  className="h-9"
                  type="date"
                  value={values[f.key] ?? ''}
                  onChange={(e) => onFilter?.(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          {active && onClear && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4" />
              {t('list.clear')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
