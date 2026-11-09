import { TicketType } from '../types/ticket.types';
import { TicketFilterState as Filters } from '../hooks/useTickets';
import { Input } from '@/shared/components/ui/input';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface Props {
  types: TicketType[];
  search: string;
  filters: Filters;
  onSearch: (value: string) => void;
  onChange: (filters: Filters) => void;
}

export function TicketFilters({ types, search, filters, onSearch, onChange }: Props) {
  const t = useT();

  const selectedType = types.find((type) => type.code === filters.type_code);

  const chip = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-200 ease-apple hover:border-foreground/25 hover:text-foreground',
      active && 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground',
    );

  return (
    <div className="space-y-3">
      <Input
        placeholder={t('tickets.search')}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <button
          type="button"
          className={chip(!filters.type_code)}
          onClick={() => onChange({ ...filters, type_code: undefined, status_code: undefined })}
        >
          {t('tickets.allTypes')}
        </button>
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            className={chip(filters.type_code === type.code)}
            onClick={() =>
              onChange({ ...filters, type_code: type.code, status_code: undefined })
            }
          >
            {type.name}
          </button>
        ))}
      </div>

      {/* Los estados dependen del tipo. Sin tipo elegido, solo abierto o cerrado. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <button
          type="button"
          className={chip(!filters.status_code && filters.open === undefined)}
          onClick={() => onChange({ ...filters, status_code: undefined, open: undefined })}
        >
          {t('common.all')}
        </button>

        {selectedType ? (
          [...selectedType.statuses]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((status) => (
              <button
                key={status.code}
                type="button"
                className={chip(filters.status_code === status.code)}
                onClick={() =>
                  onChange({ ...filters, status_code: status.code, open: undefined })
                }
              >
                {status.name}
              </button>
            ))
        ) : (
          <>
            <button
              type="button"
              className={chip(filters.open === true)}
              onClick={() => onChange({ ...filters, open: true, status_code: undefined })}
            >
              {t('tickets.onlyOpen')}
            </button>
            <button
              type="button"
              className={chip(filters.open === false)}
              onClick={() => onChange({ ...filters, open: false, status_code: undefined })}
            >
              {t('tickets.onlyClosed')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
