import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShieldCheck } from 'lucide-react';
import { AppUser } from '../types/user.types';
import { updateUser } from '../api/usersApi';
import { getPermissionOptions, PermissionOption } from '@/shared/auth/accessApi';
import { apiAxios } from '@/shared/api/api';
import { isSuccessfully } from '@/shared/api/handlers';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

interface Props {
  user: AppUser;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * Excepciones sobre el rol. La regla es visible en pantalla:
 * efectivos = rol + concedidos − revocados.
 */
export function UserPermissionsForm({ user, onSuccess, onClose }: Props) {
  const t = useT();
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [granted, setGranted] = useState<string[]>(user.granted_permissions ?? []);
  const [revoked, setRevoked] = useState<string[]>(user.revoked_permissions ?? []);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPermissionOptions().then((res) => {
      if (res.ok) setPermissions(res.data);
    });
    void apiAxios
      .get({ url: `/roles/?limit=100` })
      .then((res) => {
        if (!isSuccessfully(res.status)) return;
        const role = (res.data.data as Array<{ id: string; permissions: string[] }>).find(
          (r) => r.id === user.role_id,
        );
        setRolePermissions(role?.permissions ?? []);
      })
      .catch(() => undefined);
  }, [user.role_id]);

  const byModule = useMemo(() => {
    return permissions.reduce<Record<string, PermissionOption[]>>((acc, p) => {
      const list = acc[p.module_code] ?? [];
      list.push(p);
      acc[p.module_code] = list;
      return acc;
    }, {});
  }, [permissions]);

  const effective = useMemo(
    () =>
      Array.from(new Set([...rolePermissions, ...granted])).filter((c) => !revoked.includes(c)),
    [rolePermissions, granted, revoked],
  );

  const toggle = (code: string) => {
    const fromRole = rolePermissions.includes(code);
    if (fromRole) {
      // Un permiso del rol solo puede revocarse o devolverse.
      setRevoked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
      return;
    }
    setGranted((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const save = async () => {
    setSubmitting(true);
    const res = await updateUser(user.id, {
      granted_permissions: granted,
      revoked_permissions: revoked,
    });
    setSubmitting(false);
    if (res.ok) {
      notify.success('users.permissionsSaved', 200);
      onSuccess();
      onClose();
      return;
    }
    notify.fromApiError(res);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {user.role_name} · {effective.length} {t('roles.permissionsShort')}
        </p>
        <p className="mt-1">{t('users.permissionsHint')}</p>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {Object.keys(byModule).map((moduleCode) => (
          <div key={moduleCode} className="rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-sm font-medium">
              {t(`modules.${moduleCode}`)}
            </div>
            <ul className="divide-y divide-border">
              {(byModule[moduleCode] ?? []).map((permission) => {
                const fromRole = rolePermissions.includes(permission.code);
                const isRevoked = revoked.includes(permission.code);
                const isGranted = granted.includes(permission.code);
                const has = (fromRole && !isRevoked) || isGranted;

                return (
                  <li
                    key={permission.code}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className={cn('text-sm', !has && 'text-muted-foreground')}>
                        {permission.name}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code>{permission.code}</code>
                        {fromRole && !isRevoked && <Badge>{t('users.fromRole')}</Badge>}
                        {isGranted && <Badge variant="success">{t('users.granted')}</Badge>}
                        {isRevoked && <Badge variant="danger">{t('users.revoked')}</Badge>}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant={has ? 'ghost' : 'outline'}
                      className="shrink-0"
                      onClick={() => toggle(permission.code)}
                    >
                      {has ? (
                        <>
                          <Minus className="h-4 w-4" />
                          {t('users.take')}
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          {t('users.give')}
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex gap-3 border-t border-border pt-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button className="flex-1" disabled={isSubmitting} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
