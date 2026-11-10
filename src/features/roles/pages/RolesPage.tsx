import { useState } from 'react';
import { Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useRoles } from '../hooks/useRoles';
import { RoleForm } from '../components/RoleForm';
import { deleteRole, getRoles } from '../api/rolesApi';
import { Role } from '../types/role.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { CsvColumn } from '@/shared/utils/csv';
import { fetchAllPages } from '@/shared/utils/fetchAllPages';
import { Can } from '@/shared/components/auth/Can';
import { useCan } from '@/shared/hooks/useCan';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

export function RolesPage() {
  const t = useT();
  const roles = useRoles();
  const { can } = useCan();

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
    {
      key: 'is_system',
      label: t('list.filter.scope'),
      type: 'select',
      options: [
        { value: 'true', label: t('list.filter.system') },
        { value: 'false', label: t('list.filter.custom') },
      ],
    },
  ];

  const exportColumns: CsvColumn<Role>[] = [
    { header: t('list.col.name'), value: (r) => r.name },
    { header: t('list.col.code'), value: (r) => r.code },
    { header: t('list.col.description'), value: (r) => r.description },
    { header: t('list.col.system'), value: (r) => (r.is_system ? t('common.yes') : t('common.no')) },
    { header: t('list.col.status'), value: (r) => (r.is_active ? t('list.filter.active') : t('list.filter.inactive')) },
    { header: t('list.col.users'), value: (r) => r.users_count },
    { header: t('list.col.permissions'), value: (r) => r.permissions.join(' ') },
  ];
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const onDelete = (role: Role) => {
    notify.confirm('roles.confirmDelete', async () => {
      const res = await deleteRole(role.id);
      if (res.ok) {
        notify.toast.success(t('roles.deletedOk'));
        void roles.reload();
        return;
      }
      notify.fromApiError(res);
    });
  };

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'list.col.name',
      primary: true,
      cell: (role) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {role.name}
            {role.is_system && <Badge variant="info">{t('roles.system')}</Badge>}
          </p>
          {role.description && <p className="mt-0.5 text-sm text-muted-foreground">{role.description}</p>}
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'list.col.permissions',
      cell: (role) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {role.permissions.length} {t('roles.permissionsShort')}
        </span>
      ),
    },
    {
      key: 'users',
      header: 'list.col.users',
      cell: (role) => (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {role.users_count} {t('roles.usersShort')}
        </span>
      ),
    },
  ];

  const renderActions = (role: Role) => (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
        {role.is_system ? t('common.view') : t('common.edit')}
      </Button>
      {!role.is_system && (
        <Button size="sm" variant="ghost" onClick={() => onDelete(role)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      )}
    </>
  );

  return (
    <section className="space-y-5 p-4 md:p-6">
      <AdminTabs section="access" />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold">{t('roles.title')}</h1>
        <Can permission={PERMISSIONS.rolesManage}>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('roles.new')}
          </Button>
        </Can>
      </header>

      <ListToolbar
        search={roles.search}
        onSearch={roles.setSearch}
        filters={filterDefs}
        values={roles.filters}
        onFilter={roles.setFilter}
        onClear={roles.clear}
        actions={
          <ExportButton
            filename="roles"
            columns={exportColumns}
            disabled={roles.total === 0}
            load={() => fetchAllPages(getRoles, roles.query)}
          />
        }
      />

      <DataTable
        columns={columns}
        rows={roles.items}
        rowKey={(role) => role.id}
        isLoading={roles.isLoading}
        emptyMessage="list.noResults"
        actions={can(PERMISSIONS.rolesManage) ? renderActions : undefined}
      />

      <PaginatedComplete
        page={roles.page}
        limit={roles.limit}
        total={roles.total}
        links={roles.links}
        onPageChange={roles.setPage}
        onLimitChange={roles.setLimit}
      />

      <Dialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : t('roles.new')}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <RoleForm
              role={editing}
              onSuccess={() => void roles.reload()}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
