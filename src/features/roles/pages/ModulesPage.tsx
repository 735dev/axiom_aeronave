import { useState } from 'react';
import { KeyRound, Layers } from 'lucide-react';
import { usePermissionCatalog } from '../hooks/useRoles';
import { ModuleForm } from '../components/ModuleForm';
import { Module } from '../types/role.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { ClientPagination } from '@/shared/components/list/ClientPagination';
import { DataTable, Column } from '@/shared/components/list/DataTable';
import { useClientList } from '@/shared/hooks/useClientList';
import { CsvColumn } from '@/shared/utils/csv';
import { loadRows } from '@/shared/utils/fetchAllPages';
import { useT } from '@/shared/hooks/useT';

export function ModulesPage() {
  const t = useT();
  const { modules, isLoading, reload } = usePermissionCatalog();
  const [editing, setEditing] = useState<Module | null>(null);

  const list = useClientList<Module>({
    items: modules,
    searchText: (m) => `${m.name} ${m.code} ${m.route ?? ''} ${m.description ?? ''}`,
    filters: {
      menu: (m, v) => (v === 'shown') === Boolean(m.show_in_menu && m.route),
      origin: (m, v) => (v === 'system') === m.is_system,
      state: (m, v) => (v === 'active') === m.is_active,
    },
  });

  const filters: FilterDef[] = [
    {
      key: 'menu',
      label: t('listData.menu'),
      type: 'select',
      options: [
        { value: 'shown', label: t('listData.menuShown') },
        { value: 'hidden', label: t('listData.menuHidden') },
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
    {
      key: 'state',
      label: t('listData.state'),
      type: 'select',
      options: [
        { value: 'active', label: t('listData.stateActive') },
        { value: 'inactive', label: t('listData.stateInactive') },
      ],
    },
  ];

  const yesNo = (v: boolean) => t(v ? 'common.yes' : 'common.no');
  const csvColumns: CsvColumn<Module>[] = [
    { header: t('listData.csv.code'), value: (m) => m.code },
    { header: t('listData.csv.name'), value: (m) => m.name },
    { header: t('listData.csv.description'), value: (m) => m.description },
    { header: t('listData.csv.route'), value: (m) => m.route },
    { header: t('listData.csv.inMenu'), value: (m) => yesNo(Boolean(m.show_in_menu && m.route)) },
    { header: t('listData.csv.permissions'), value: (m) => m.permissions_count },
    { header: t('listData.csv.system'), value: (m) => yesNo(m.is_system) },
    { header: t('listData.csv.active'), value: (m) => yesNo(m.is_active) },
  ];

  const tableColumns: Column<Module>[] = [
    {
      key: 'name',
      header: 'listData.csv.name',
      primary: true,
      cell: (m) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {m.name}
          </p>
          <code className="mt-0.5 block text-xs text-muted-foreground">{m.code}</code>
          {m.description && <p className="mt-1 text-sm font-normal text-muted-foreground">{m.description}</p>}
        </div>
      ),
    },
    { key: 'route', header: 'listData.csv.route', cell: (m) => (m.route ? <code className="text-xs">{m.route}</code> : '—') },
    {
      key: 'menu',
      header: 'listData.csv.inMenu',
      cell: (m) =>
        m.show_in_menu && m.route ? (
          <Badge variant="success">{t('modules.inMenu')}</Badge>
        ) : (
          <Badge>{t('modules.hidden')}</Badge>
        ),
    },
    {
      key: 'permissions',
      header: 'listData.csv.permissions',
      align: 'right',
      cell: (m) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          {m.permissions_count}
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-5 p-4 md:p-6">
      <AdminTabs section="access" />

      <header>
        <h1 className="text-2xl font-extrabold">{t('modules.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('modules.subtitle')}</p>
      </header>

      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder={t('listData.searchModules')}
        filters={filters}
        values={list.values}
        onFilter={list.setFilter}
        onClear={list.clear}
        actions={
          <ExportButton
            filename={t('modules.title')}
            columns={csvColumns}
            load={loadRows(list.filtered)}
            disabled={list.total === 0}
          />
        }
      />

      <DataTable
        columns={tableColumns}
        rows={list.rows}
        rowKey={(m) => m.id}
        isLoading={isLoading}
        emptyMessage={modules.length > 0 ? 'list.noResults' : 'common.empty'}
        actions={(m) => (
          <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
            {t('modules.menuConfig')}
          </Button>
        )}
      />

      <ClientPagination list={list} />

      <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {t('modules.routeHint')}
      </p>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editing && (
              <ModuleForm module={editing} onSuccess={reload} onClose={() => setEditing(null)} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
