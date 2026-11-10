import { useState } from 'react';
import { LayoutList, Lock, Plus, Trash2 } from 'lucide-react';
import { useTicketTypes } from '../hooks/useTickets';
import { TicketTypeForm } from '../components/builder/TicketTypeForm';
import { deleteTicketType, updateTicketType } from '../api/ticketsApi';
import { TicketType } from '../types/ticket.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { ClientPagination } from '@/shared/components/list/ClientPagination';
import { DataTable, Column } from '@/shared/components/list/DataTable';
import { useClientList } from '@/shared/hooks/useClientList';
import { CsvColumn } from '@/shared/utils/csv';
import { loadRows } from '@/shared/utils/fetchAllPages';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

export function TicketTypesPanel() {
  const t = useT();
  const { types, isLoading, reload } = useTicketTypes();
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useClientList<TicketType>({
    items: types,
    searchText: (x) => `${x.name} ${x.code} ${x.description ?? ''} ${x.default_role_name ?? ''}`,
    filters: {
      state: (x, v) => (v === 'active') === x.is_active,
      kind: (x, v) => (v === 'root') === x.is_root,
      origin: (x, v) => (v === 'system') === x.is_system,
    },
  });

  const filters: FilterDef[] = [
    {
      key: 'state',
      label: t('listData.state'),
      type: 'select',
      options: [
        { value: 'active', label: t('listData.stateActive') },
        { value: 'inactive', label: t('listData.stateInactive') },
      ],
    },
    {
      key: 'kind',
      label: t('listData.kind'),
      type: 'select',
      options: [
        { value: 'root', label: t('listData.kindRoot') },
        { value: 'child', label: t('listData.kindChild') },
      ],
    },
    {
      key: 'origin',
      label: t('listData.origin'),
      type: 'select',
      options: [
        { value: 'system', label: t('listData.originSystem') },
        { value: 'custom', label: t('listData.originCustom') },
      ],
    },
  ];

  const yesNo = (v: boolean) => t(v ? 'common.yes' : 'common.no');
  const csvColumns: CsvColumn<TicketType>[] = [
    { header: t('listData.csv.code'), value: (x) => x.code },
    { header: t('listData.csv.name'), value: (x) => x.name },
    { header: t('listData.csv.description'), value: (x) => x.description },
    { header: t('listData.csv.root'), value: (x) => yesNo(x.is_root) },
    { header: t('listData.csv.active'), value: (x) => yesNo(x.is_active) },
    { header: t('listData.csv.system'), value: (x) => yesNo(x.is_system) },
    { header: t('listData.csv.role'), value: (x) => x.default_role_name },
    { header: t('listData.csv.fields'), value: (x) => x.fields.length },
    { header: t('listData.csv.statuses'), value: (x) => x.statuses.length },
    { header: t('listData.csv.steps'), value: (x) => x.steps.length },
    { header: t('listData.csv.tickets'), value: (x) => x.tickets_count },
  ];

  const tableColumns: Column<TicketType>[] = [
    {
      key: 'name',
      header: 'listData.csv.name',
      primary: true,
      cell: (type) => (
        <div className="min-w-0">
          <p className={cn('flex flex-wrap items-center gap-2 font-medium', !type.is_active && 'text-muted-foreground line-through')}>
            {type.name}
            {type.is_system && (
              <Badge variant="info">
                <Lock className="mr-1 h-3 w-3" />
                {t('catalogs.system')}
              </Badge>
            )}
            {type.is_root && <Badge variant="warning">{t('ticketTypes.rootBadge')}</Badge>}
            {type.blocks_parent_close && <Badge variant="warning">{t('ticketTypes.blocking')}</Badge>}
          </p>
          {type.description && <p className="mt-1 text-sm font-normal text-muted-foreground">{type.description}</p>}
        </div>
      ),
    },
    { key: 'role', header: 'listData.csv.role', cell: (type) => type.default_role_name ?? '—' },
    { key: 'fields', header: 'listData.csv.fields', align: 'right', cell: (type) => type.fields.length },
    { key: 'statuses', header: 'listData.csv.statuses', align: 'right', cell: (type) => type.statuses.length },
    { key: 'steps', header: 'listData.csv.steps', align: 'right', cell: (type) => type.steps.length },
    { key: 'tickets', header: 'listData.csv.tickets', align: 'right', cell: (type) => type.tickets_count },
  ];

  const onToggle = async (type: TicketType) => {
    const res = await updateTicketType(type.id, { is_active: !type.is_active });
    if (res.ok) {
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  const onDelete = (type: TicketType) => {
    notify.confirm('ticketTypes.confirmDelete', async () => {
      const res = await deleteTicketType(type.id);
      if (res.ok) {
        notify.toast.success(t('ticketTypes.deletedOk'));
        void reload();
        return;
      }
      notify.fromApiError(res);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <LayoutList className="h-4 w-4 text-muted-foreground" />
            {t('ticketTypes.title')}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('ticketTypes.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t('ticketTypes.new')}
        </Button>
      </div>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder={t('listData.searchTicketTypes')}
        filters={filters}
        values={list.values}
        onFilter={list.setFilter}
        onClear={list.clear}
        actions={
          <ExportButton
            filename={t('ticketTypes.title')}
            columns={csvColumns}
            load={loadRows(list.filtered)}
            disabled={list.total === 0}
          />
        }
      />
      <DataTable
        columns={tableColumns}
        rows={list.rows}
        rowKey={(type) => type.id}
        isLoading={isLoading}
        emptyMessage={types.length > 0 ? 'list.noResults' : 'common.empty'}
        actions={(type) => (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(type)}>
              {t('ticketTypes.editForm')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onToggle(type)}>
              {type.is_active ? t('catalogs.disable') : t('catalogs.enable')}
            </Button>
            {!type.is_system && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(type)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />

      <ClientPagination list={list} />

      <Dialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : t('ticketTypes.new')}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <TicketTypeForm
              type={editing}
              allTypes={types}
              onSuccess={reload}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
