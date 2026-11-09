import { useState } from 'react';
import { Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useRoles } from '../hooks/useRoles';
import { RoleForm } from '../components/RoleForm';
import { deleteRole } from '../api/rolesApi';
import { Role } from '../types/role.types';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { Can } from '@/shared/components/auth/Can';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

export function RolesPage() {
  const t = useT();
  const roles = useRoles();
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

      <Input
        placeholder={t('common.search')}
        value={roles.search}
        onChange={(e) => roles.setSearch(e.target.value)}
      />

      <div className="space-y-3">
        {roles.items.map((role) => (
          <Card key={role.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {role.name}
                  {role.is_system && <Badge variant="info">{t('roles.system')}</Badge>}
                </p>
                {role.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {role.permissions.length} {t('roles.permissionsShort')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {role.users_count} {t('roles.usersShort')}
                  </span>
                </div>
              </div>
              <Can permission={PERMISSIONS.rolesManage}>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                    {role.is_system ? t('common.view') : t('common.edit')}
                  </Button>
                  {!role.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(role)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </Can>
            </div>
          </Card>
        ))}
      </div>

      <PaginatedComplete
        page={roles.page}
        limit={roles.limit}
        total={roles.total}
        links={roles.links}
        onPageChange={roles.setPage}
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
