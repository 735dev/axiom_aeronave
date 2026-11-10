import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Lock, Plus, Trash2 } from 'lucide-react';
import { useCatalogDefinitions, useCatalogItems } from '../hooks/useCatalog';
import { CatalogItemForm } from '../components/CatalogItemForm';
import { deleteCatalogItem, getCatalogItems, importCatalogItems, updateCatalogItem } from '../api/catalogsApi';
import { CatalogItem, CatalogKey } from '../types/catalog.types';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { ImportDialog } from '@/shared/components/list/ImportDialog';
import { CsvColumn } from '@/shared/utils/csv';
import { fetchAllPages } from '@/shared/utils/fetchAllPages';
import { Can } from '@/shared/components/auth/Can';
import { useCan } from '@/shared/hooks/useCan';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

const IMPORT_COLUMNS = ['code', 'name', 'extra'];
const IMPORT_REQUIRED = ['code', 'name'];

export function CatalogListPanel() {
  const t = useT();
  const { definitions, reload: reloadDefinitions } = useCatalogDefinitions();
  const [params] = useSearchParams();
  const active = (params.get('tipo') as CatalogKey) ?? 'expense_concepts';
  const items = useCatalogItems(active);
  const { can } = useCan();
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    void items.reload();
    void reloadDefinitions();
  };

  const onToggle = async (item: CatalogItem) => {
    const res = await updateCatalogItem(item.id, { is_active: !item.is_active });
    if (res.ok) {
      refresh();
      return;
    }
    notify.fromApiError(res);
  };

  const onDelete = (item: CatalogItem) => {
    notify.confirm('catalogs.confirmDelete', async () => {
      const res = await deleteCatalogItem(item.id);
      if (res.ok) {
        notify.toast.success(t('catalogs.deletedOk'));
        refresh();
        return;
      }
      notify.fromApiError(res);
    });
  };

  const current = definitions.find((d) => d.key === active);

  const filterDefs: FilterDef[] = [
    {
      key: 'is_active',
      label: t('list.filter.status'),
      type: 'select',
      options: [
        { value: 'true', label: t('list.filter.active') },
        { value: 'false', label: t('list.filter.inactive') },
      ],
    },
  ];

  // Mismas cabeceras que la plantilla de importación: lo exportado se puede volver a importar.
  const exportColumns: CsvColumn<CatalogItem>[] = [
    { header: 'code', value: (i) => i.code },
    { header: 'name', value: (i) => i.name },
    { header: 'extra', value: (i) => i.extra },
    { header: 'is_active', value: (i) => i.is_active },
    { header: 'is_system', value: (i) => i.is_system },
  ];

  const columns: Column<CatalogItem>[] = [
    {
      key: 'name',
      header: 'list.col.name',
      primary: true,
      cell: (item) => (
        <span className={cn(!item.is_active && 'text-muted-foreground line-through')}>{item.name}</span>
      ),
    },
    { key: 'code', header: 'list.col.code', cell: (item) => <code className="text-xs">{item.code}</code> },
    {
      key: 'extra',
      header: 'list.col.extra',
      cell: (item) => <span className="text-muted-foreground">{item.extra || '—'}</span>,
    },
    {
      key: 'status',
      header: 'list.col.status',
      cell: (item) => (
        <span className="flex flex-wrap items-center gap-2 md:justify-start">
          <Badge variant={item.is_active ? 'success' : 'default'}>
            {item.is_active ? t('list.filter.active') : t('list.filter.inactive')}
          </Badge>
          {item.is_system && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {t('catalogs.system')}
            </span>
          )}
        </span>
      ),
    },
  ];

  const renderActions = (item: CatalogItem) => (
    <>
      <Button size="sm" variant="ghost" onClick={() => void onToggle(item)}>
        {item.is_active ? t('catalogs.disable') : t('catalogs.enable')}
      </Button>
      {!item.is_system && (
        <Button size="sm" variant="ghost" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </>
  );

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <Database className="h-4 w-4 text-muted-foreground" />
            {current?.name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{current?.description}</p>
        </div>
        <Can permission={PERMISSIONS.catalogsManage}>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('catalogs.new')}
          </Button>
        </Can>
      </div>

      <div className="border-b border-border p-4">
        <ListToolbar
          search={items.search}
          onSearch={items.setSearch}
          filters={filterDefs}
          values={items.filters}
          onFilter={items.setFilter}
          onClear={items.clear}
          actions={
            <>
              <ExportButton
                filename={`catalogo-${active}`}
                columns={exportColumns}
                disabled={items.total === 0}
                load={() => fetchAllPages(getCatalogItems, items.query)}
              />
              <Can permission={PERMISSIONS.catalogsManage}>
                <ImportDialog
                  title={`${t('catalogs.import')}: ${current?.name ?? active}`}
                  columns={IMPORT_COLUMNS}
                  required={IMPORT_REQUIRED}
                  templateName={`plantilla-${active}`}
                  run={(rows, dryRun) => importCatalogItems(active, rows, dryRun)}
                  onDone={refresh}
                />
              </Can>
            </>
          }
        />
      </div>

      <div className="p-4">
        <DataTable
          columns={columns}
          rows={items.items}
          rowKey={(item) => item.id}
          isLoading={items.isLoading}
          emptyMessage={
            items.search || Object.values(items.filters).some(Boolean) ? 'list.noResults' : 'common.empty'
          }
          actions={can(PERMISSIONS.catalogsManage) ? renderActions : undefined}
        />
      </div>

      <div className="border-t border-border p-4">
        <PaginatedComplete
          page={items.page}
          limit={items.limit}
          total={items.total}
          links={items.links}
          onPageChange={items.setPage}
          onLimitChange={items.setLimit}
        />
      </div>

      <p className="border-t border-border p-4 text-xs text-muted-foreground">
        <Badge variant="info">{t('catalogs.system')}</Badge> {t('catalogs.systemHint')}
      </p>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current?.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <CatalogItemForm
              catalog={active}
              onSuccess={refresh}
              onClose={() => setCreating(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
