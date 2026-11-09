import { useEffect, useState } from 'react';
import { updateModule } from '../api/rolesApi';
import { Module } from '../types/role.types';
import { getPermissionOptions, PermissionOption } from '@/shared/auth/accessApi';
import { ICON_NAMES, MODULE_ROUTES } from '@/shared/config/moduleRoutes';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { notifyMenuChanged } from '@/shared/hooks/useMenu';

interface Props {
  module: Module;
  onSuccess: () => void;
  onClose: () => void;
}

export function ModuleForm({ module, onSuccess, onClose }: Props) {
  const t = useT();
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [name, setName] = useState(module.name);
  const [route, setRoute] = useState(module.route ?? '');
  const [icon, setIcon] = useState(module.icon ?? 'ticket');
  const [menuPermission, setMenuPermission] = useState(module.menu_permission ?? '');
  const [showInMenu, setShowInMenu] = useState(module.show_in_menu);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getPermissionOptions().then((res) => {
      if (res.ok) setPermissions(res.data);
    });
  }, []);

  const onSubmit = async () => {
    setSubmitting(true);
    const payload = {
      name,
      route: route || undefined,
      icon,
      menu_permission: menuPermission || undefined,
      show_in_menu: showInMenu,
    };
    const res = await updateModule(module.id, payload);
    setSubmitting(false);
    if (res.ok) {
      notify.toast.success(t('modules.updatedOk'));
      notifyMenuChanged();
      onSuccess();
      onClose();
      return;
    }
    notify.fromApiError(res);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">{t('modules.menuLabel')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">{t('modules.route')}</Label>
          <Select value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">{t('modules.noRoute')}</option>
            {MODULE_ROUTES.map((r) => (
              <option key={r.route} value={r.route}>
                {t(r.labelKey)} · {r.route}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">{t('modules.icon')}</Label>
          <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICON_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">{t('modules.menuPermission')}</Label>
        <Select value={menuPermission} onChange={(e) => setMenuPermission(e.target.value)}>
          <option value="">{t('ticketTypes.everyone')}</option>
          {permissions.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} · {p.code}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={showInMenu}
          onChange={(e) => setShowInMenu(e.target.checked)}
        />
        {t('modules.showInMenu')}
      </label>

      <p className="rounded-md border border-amber-600/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        {t('modules.routeHint')}
      </p>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" className="flex-1" disabled={isSubmitting} onClick={() => void onSubmit()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
