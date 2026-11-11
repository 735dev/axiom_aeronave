import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useAuditLog } from '../hooks/useAudit';
import { exportAuditCsv } from '../api/auditApi';
import { AuditDetail } from '../components/AuditDetail';
import { AuditAction, AuditEntity, AuditEvent, AuditFilters } from '../types/audit.types';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { Badge } from '@/shared/components/ui/badge';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { formatDateTime } from '@/shared/utils/formatters';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { orUndefined, useListFilters } from '@/shared/hooks/useListFilters';
import { useT } from '@/shared/hooks/useT';
import { downloadCsv } from '@/shared/utils/csv';
import { notify } from '@/shared/utils/notify';

const ACTIONS: AuditAction[] = [
  'create',
  'update',
  'status_change',
  'decision',
  'comment',
  'permission_change',
  'login',
  'login_failed',
  'denied',
];

/** Las acciones sensibles se marcan para que salten a la vista al revisar. */
const SENSITIVE: AuditAction[] = ['permission_change', 'delete', 'login_failed', 'denied'];

const ENTITIES: AuditEntity[] = [
  'ticket',
  'user',
  'role',
  'ticket_type',
  'catalog',
  'reconciliation',
  'passenger',
  'notification',
  'session',
];

export function AuditPage() {
  const t = useT();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { values, setFilter, reset } = useListFilters();
  const [exporting, setExporting] = useState(false);
  // Cada hecho es una línea; el detalle se abre a pedido y puede haber varios abiertos.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const filters = useMemo<AuditFilters>(
    () => ({
      search: orUndefined(debounced.trim()),
      entity: orUndefined(values.entity) as AuditEntity | undefined,
      action: orUndefined(values.action) as AuditAction | undefined,
      from: orUndefined(values.from),
      to: orUndefined(values.to),
    }),
    [debounced, values],
  );
  const { items, isLoading, total, page, limit, links, setPage, setLimit } = useAuditLog(filters);

  const filterDefs: FilterDef[] = [
    {
      key: 'entity',
      label: t('audit.entity'),
      type: 'select',
      options: ENTITIES.map((e) => ({ value: e, label: t(`audit.entities.${e}`) })),
    },
    {
      key: 'action',
      label: t('audit.action'),
      type: 'select',
      options: ACTIONS.map((a) => ({ value: a, label: t(`audit.actions.${a}`) })),
    },
    { key: 'from', label: t('audit.from'), type: 'date' },
    { key: 'to', label: t('audit.to'), type: 'date' },
  ];

  // El servidor arma el CSV con los mismos filtros: es la fuente de la verdad de la bitácora.
  const onExport = async () => {
    setExporting(true);
    const res = await exportAuditCsv(filters);
    setExporting(false);
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    downloadCsv(res.data.filename, res.data.text);
  };

  const columns: Column<AuditEvent>[] = [
    {
      key: 'when',
      header: 'list.col.when',
      cell: (e) => <span className="data whitespace-nowrap text-xs">{formatDateTime(e.at)}</span>,
    },
    {
      key: 'actor',
      header: 'list.col.actor',
      cell: (e) => (
        <div className="min-w-0">
          <p className="font-medium">{e.actor_name}</p>
          <p className="text-xs text-muted-foreground">{e.actor_role}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'list.col.action',
      cell: (e) => (
        <Badge variant={SENSITIVE.includes(e.action) ? 'danger' : 'default'}>
          {t(`audit.actions.${e.action}`)}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'list.col.entity',
      cell: (e) => (
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t(`audit.entities.${e.entity}`)}</p>
          <p className="data text-xs">{e.entity_label}</p>
        </div>
      ),
    },
    { key: 'summary', header: 'list.col.summary', primary: true, cell: (e) => e.summary },
  ];

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t('audit.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </header>

      <Card className="p-4">
        <ListToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder={t('audit.searchHint')}
          filters={filterDefs}
          values={values}
          onFilter={setFilter}
          onClear={() => {
            setSearch('');
            reset();
          }}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting || total === 0}
              onClick={() => void onExport()}
            >
              <Download className="h-4 w-4" />
              {exporting ? t('common.loading') : t('list.export')}
            </Button>
          }
        />
      </Card>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(event) => event.id}
        isLoading={isLoading}
        emptyMessage="audit.empty"
        onRowClick={(event) => toggle(event.id)}
        actions={(event) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open.has(event.id)}
            onClick={() => toggle(event.id)}
          >
            {open.has(event.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {open.has(event.id) ? t('audit.detail.hide') : t('audit.detail.show')}
          </Button>
        )}
        renderExpanded={(event) => (open.has(event.id) ? <AuditDetail event={event} /> : null)}
      />

      <PaginatedComplete
        page={page}
        limit={limit}
        total={total}
        links={links}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </section>
  );
}
