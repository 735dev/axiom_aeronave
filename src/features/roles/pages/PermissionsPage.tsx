import { useMemo, useState } from 'react';
import { usePermissionCatalog } from '../hooks/useRoles';
import { PermissionsTree } from '../components/PermissionsTree';
import { Permission } from '../types/role.types';
import { Card } from '@/shared/components/ui/card';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { CsvColumn } from '@/shared/utils/csv';
import { loadRows } from '@/shared/utils/fetchAllPages';
import { useT } from '@/shared/hooks/useT';

export function PermissionsPage() {
  const t = useT();
  const { permissions, modules, byModule, isLoading } = usePermissionCatalog();
  const [query, setQuery] = useState('');
  const [moduleCode, setModuleCode] = useState('');

  // El árbol agrupa por módulo: el filtro de módulo lo recorta en vez de paginarlo.
  const shownModules = useMemo(
    () => (moduleCode ? modules.filter((m) => m.code === moduleCode) : modules),
    [modules, moduleCode],
  );

  const filters: FilterDef[] = [
    {
      key: 'module',
      label: t('listData.module'),
      type: 'select',
      options: modules.map((m) => ({ value: m.code, label: m.name })),
    },
  ];

  const moduleName = (code: string) => modules.find((m) => m.code === code)?.name ?? code;
  const exportRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return permissions.filter(
      (p) =>
        (!moduleCode || p.module_code === moduleCode) &&
        (!needle || `${p.name} ${p.code} ${p.description ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [permissions, moduleCode, query]);

  const columns: CsvColumn<Permission>[] = [
    { header: t('listData.csv.module'), value: (p) => moduleName(p.module_code) },
    { header: t('listData.csv.code'), value: (p) => p.code },
    { header: t('listData.csv.name'), value: (p) => p.name },
    { header: t('listData.csv.description'), value: (p) => p.description },
    { header: t('listData.csv.system'), value: (p) => t(p.is_system ? 'common.yes' : 'common.no') },
    { header: t('listData.csv.active'), value: (p) => t(p.is_active ? 'common.yes' : 'common.no') },
  ];

  return (
    <section className="space-y-5 p-4 md:p-6">
      <AdminTabs section="access" />

      <header>
        <h1 className="text-2xl font-extrabold">{t('permissions.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
      </header>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder={t('permissions.search')}
        filters={filters}
        values={{ module: moduleCode }}
        onFilter={(_, v) => setModuleCode(v)}
        onClear={() => {
          setQuery('');
          setModuleCode('');
        }}
        actions={
          <ExportButton
            filename={t('permissions.title')}
            columns={columns}
            load={loadRows(exportRows)}
            disabled={exportRows.length === 0}
          />
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <Card>
        <PermissionsTree modules={shownModules} byModule={byModule} query={query} />
      </Card>

      <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {t('permissions.readOnlyNote')}
      </p>
    </section>
  );
}
