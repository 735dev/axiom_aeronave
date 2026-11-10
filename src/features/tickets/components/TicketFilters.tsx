import { ReactNode } from 'react';
import { TicketType } from '../types/ticket.types';
import { TicketFilterState as Filters } from '../hooks/useTickets';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface Props {
  types: TicketType[];
  search: string;
  filters: Filters;
  onSearch: (value: string) => void;
  onChange: (filters: Filters) => void;
  onClear?: () => void;
  /** Aeronaves que se pueden filtrar (código → nombre). */
  aircraftOptions?: Array<{ value: string; label: string }>;
  /** Exportar y demás acciones de la lista. */
  actions?: ReactNode;
}

export function TicketFilters({
  types,
  search,
  filters,
  onSearch,
  onChange,
  onClear,
  aircraftOptions = [],
  actions,
}: Props) {
  const t = useT();

  // Lo que no son chips (aeronave, rango de fechas) va en la barra común de listas.
  const extra: FilterDef[] = [
    ...(aircraftOptions.length > 0
      ? ([{ key: 'aircraft', label: t('list.filter.aircraft'), type: 'select', options: aircraftOptions }] as FilterDef[])
      : []),
    { key: 'from', label: t('audit.from'), type: 'date' },
    { key: 'to', label: t('audit.to'), type: 'date' },
  ];
  const extraValues = {
    aircraft: filters.aircraft ?? '',
    from: filters.from ?? '',
    to: filters.to ?? '',
  };

  const selectedType = types.find((type) => type.code === filters.type_code);

  const chip = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-200 ease-apple hover:border-foreground/25 hover:text-foreground',
      active && 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground',
    );

  return (
    <div className="space-y-3">
      <ListToolbar
        search={search}
        onSearch={onSearch}
        searchPlaceholder={t('tickets.search')}
        filters={extra}
        values={extraValues}
        onFilter={(key, value) => onChange({ ...filters, [key]: value || undefined })}
        onClear={onClear}
        actions={actions}
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
