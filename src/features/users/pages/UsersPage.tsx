import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plane, Plus } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { UserForm } from '../components/UserForm';
import { UserPermissionsForm } from '../components/UserPermissionsForm';
import { getUsers, importUsers, updateUser } from '../api/usersApi';
import { AppUser } from '../types/user.types';
import { Avatar } from '@/shared/components/ui/avatar';
import { useCatalogOptions } from '@/features/catalogs/hooks/useCatalog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { ImportDialog } from '@/shared/components/list/ImportDialog';
import { getRoleOptions } from '@/shared/auth/accessApi';
import { CsvColumn } from '@/shared/utils/csv';
import { fetchAllPages } from '@/shared/utils/fetchAllPages';
import { formatDate } from '@/shared/utils/formatters';
import { Can } from '@/shared/components/auth/Can';
import { useCan } from '@/shared/hooks/useCan';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

const IMPORT_COLUMNS = ['full_name', 'email', 'phone', 'role_code', 'location', 'aircraft_id'];
const IMPORT_REQUIRED = ['full_name', 'email', 'role_code'];

export function UsersPage() {
  const t = useT();
  const users = useUsers();
  const { can } = useCan();
  const aircraftOptions = useCatalogOptions('aircrafts');
  const locationOptions = useCatalogOptions('locations');
  const [roleOptions, setRoleOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    void getRoleOptions().then((res) => {
      if (res.ok) setRoleOptions(res.data.map((r) => ({ value: r.id, label: r.name })));
    });
  }, []);

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'is_active',
        label: t('list.filter.status'),
        type: 'select',
        options: [
          { value: 'true', label: t('list.filter.active') },
          { value: 'false', label: t('list.filter.inactive') },
        ],
      },
      { key: 'role_id', label: t('list.filter.role'), type: 'select', options: roleOptions },
      { key: 'location', label: t('list.filter.location'), type: 'select', options: locationOptions },
      { key: 'aircraft_id', label: t('list.filter.aircraft'), type: 'select', options: aircraftOptions },
    ],
    [t, roleOptions, locationOptions, aircraftOptions],
  );

  const exportColumns: CsvColumn<AppUser>[] = [
    { header: t('list.col.name'), value: (u) => u.full_name },
    { header: t('list.col.email'), value: (u) => u.email },
    { header: t('list.col.phone'), value: (u) => u.phone },
    { header: t('list.col.role'), value: (u) => u.role_name },
    { header: t('list.col.location'), value: (u) => u.location },
    { header: t('list.col.aircraft'), value: (u) => u.aircraft_id },
    {
      header: t('list.col.status'),
      value: (u) => (u.is_active ? t('list.filter.active') : t('list.filter.inactive')),
    },
    { header: t('list.col.created'), value: (u) => formatDate(u.created_at) },
  ];

  /** El listado guarda la matrícula; el modelo se resuelve por catálogo. */
  const aircraftName = (code: string) =>
    aircraftOptions.find((o) => o.value === code)?.label ?? '';
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [permissionsFor, setPermissionsFor] = useState<AppUser | null>(null);

  const onToggleActive = async (user: AppUser) => {
    const res = await updateUser(user.id, { is_active: !user.is_active });
    if (res.ok) {
      void users.reload();
      return;
    }
    notify.fromApiError(res);
  };

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      header: 'list.col.name',
      primary: true,
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.full_name} src={user.avatar_url} className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {user.full_name}
              {!user.is_active && <Badge variant="danger">{t('users.inactive')}</Badge>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'list.col.role',
      cell: (user) => (
        <div className="flex flex-wrap items-center gap-2 md:justify-start">
          <Badge variant="info">{user.role_name}</Badge>
          {(user.granted_permissions?.length ?? 0) > 0 && (
            <Badge variant="success">
              +{user.granted_permissions.length} {t('users.grantedShort')}
            </Badge>
          )}
          {(user.revoked_permissions?.length ?? 0) > 0 && (
            <Badge variant="danger">
              −{user.revoked_permissions.length} {t('users.revokedShort')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'list.col.location',
      cell: (user) =>
        user.location ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {user.location}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'aircraft',
      header: 'list.col.aircraft',
      cell: (user) =>
        user.aircraft_id ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Plane className="h-3 w-3" />
            <span className="data">{user.aircraft_id}</span>
            {aircraftName(user.aircraft_id)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const renderActions = (user: AppUser) => (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
        {t('common.edit')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setPermissionsFor(user)}>
        {t('users.permissions')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void onToggleActive(user)}>
        {user.is_active ? t('users.deactivate') : t('users.activate')}
      </Button>
    </>
  );

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold">{t('users.title')}</h1>
        <Can permission={PERMISSIONS.usersManage}>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('users.new')}
          </Button>
        </Can>
      </header>

      <ListToolbar
        search={users.search}
        onSearch={users.setSearch}
        searchPlaceholder={t('users.search')}
        filters={filterDefs}
        values={users.filters}
        onFilter={users.setFilter}
        onClear={users.clear}
        actions={
          <>
            <ExportButton
              filename="usuarios"
              columns={exportColumns}
              disabled={users.total === 0}
              load={() => fetchAllPages(getUsers, users.query)}
            />
            <Can permission={PERMISSIONS.usersManage}>
              <ImportDialog
                title={t('users.import')}
                columns={IMPORT_COLUMNS}
                required={IMPORT_REQUIRED}
                templateName="plantilla-usuarios"
                run={importUsers}
                onDone={() => void users.reload()}
              />
            </Can>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={users.items}
        rowKey={(user) => user.id}
        isLoading={users.isLoading}
        emptyMessage="list.noResults"
        rowClassName={(user) => (user.is_active ? undefined : 'opacity-70')}
        actions={can(PERMISSIONS.usersManage) ? renderActions : undefined}
      />

      <PaginatedComplete
        page={users.page}
        limit={users.limit}
        total={users.total}
        links={users.links}
        onPageChange={users.setPage}
        onLimitChange={users.setLimit}
      />

      <Dialog open={Boolean(permissionsFor)} onOpenChange={(v) => !v && setPermissionsFor(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{permissionsFor?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {permissionsFor && (
              <UserPermissionsForm
                user={permissionsFor}
                onSuccess={() => void users.reload()}
                onClose={() => setPermissionsFor(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? editing.full_name : t('users.new')}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <UserForm
              user={editing}
              onSuccess={() => void users.reload()}
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
