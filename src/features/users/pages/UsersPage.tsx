import { useState } from 'react';
import { MapPin, Plane, Plus } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { UserForm } from '../components/UserForm';
import { UserPermissionsForm } from '../components/UserPermissionsForm';
import { updateUser } from '../api/usersApi';
import { AppUser } from '../types/user.types';
import { Card } from '@/shared/components/ui/card';
import { Avatar } from '@/shared/components/ui/avatar';
import { useCatalogOptions } from '@/features/catalogs/hooks/useCatalog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { Can } from '@/shared/components/auth/Can';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

export function UsersPage() {
  const t = useT();
  const users = useUsers();
  const aircraftOptions = useCatalogOptions('aircrafts');

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

      <Input
        placeholder={t('users.search')}
        value={users.search}
        onChange={(e) => users.setSearch(e.target.value)}
      />

      <div className="space-y-3">
        {users.items.map((user) => (
          <Card key={user.id} className="p-4">
            {/* En móvil la ficha se apila; los botones solo van al costado
                cuando hay ancho de sobra, o se montan sobre el nombre. */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar name={user.full_name} src={user.avatar_url} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {user.full_name}
                  {!user.is_active && <Badge variant="danger">{t('users.inactive')}</Badge>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {user.location && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {user.location}
                    </span>
                  )}
                  {user.aircraft_id && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Plane className="h-3 w-3" />
                      <span className="data">{user.aircraft_id}</span>
                      {aircraftName(user.aircraft_id)}
                    </span>
                  )}
                </div>
                </div>
              </div>
              <Can permission={PERMISSIONS.usersManage}>
                <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                    {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPermissionsFor(user)}>
                    {t('users.permissions')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void onToggleActive(user)}>
                    {user.is_active ? t('users.deactivate') : t('users.activate')}
                  </Button>
                </div>
              </Can>
            </div>
          </Card>
        ))}
      </div>

      <PaginatedComplete
        page={users.page}
        limit={users.limit}
        total={users.total}
        links={users.links}
        onPageChange={users.setPage}
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
