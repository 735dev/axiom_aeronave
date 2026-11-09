import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RoleInput, roleSchema } from '../schemas/roleSchema';
import { createRole, updateRole } from '../api/rolesApi';
import { Role } from '../types/role.types';
import { usePermissionCatalog } from '../hooks/useRoles';
import { PermissionMatrix } from './PermissionMatrix';
import { FormInput } from '@/shared/components/form/FormInput';
import { FormTextarea } from '@/shared/components/form/FormTextarea';
import { Button } from '@/shared/components/ui/button';
import { applyServerErrors } from '@/shared/utils/applyServerErrors';
import { notify } from '@/shared/utils/notify';
import { useT } from '@/shared/hooks/useT';

interface Props {
  role?: Role | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function RoleForm({ role, onSuccess, onClose }: Props) {
  const t = useT();
  const { byModule, modules } = usePermissionCatalog();
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);

  const methods = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  });

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const toggleModule = (codes: string[], allSelected: boolean) =>
    setSelected((prev) =>
      allSelected
        ? prev.filter((c) => !codes.includes(c))
        : Array.from(new Set([...prev, ...codes])),
    );

  const onSubmit = async (input: RoleInput) => {
    if (selected.length === 0) {
      notify.toast.error(t('roles.noPermissions'));
      return;
    }
    const payload = { ...input, permissions: selected };
    const res = role ? await updateRole(role.id, payload) : await createRole(payload);
    if (res.ok) {
      notify.success(role ? 'roles.updatedOk' : 'roles.createdOk', role ? 200 : 201);
      onSuccess();
      onClose();
      return;
    }
    if (res.status === 422) applyServerErrors(methods.setError, res);
    notify.fromApiError(res);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput<RoleInput> name="name" label="roles.fields.name" />
        <FormTextarea<RoleInput> name="description" label="roles.fields.description" />

        <div>
          <p className="mb-2 text-sm font-medium">
            {t('roles.permissions')}{' '}
            <span className="text-muted-foreground">({selected.length})</span>
          </p>
          <div className="max-h-[45vh] overflow-y-auto pr-1">
            <PermissionMatrix
              byModule={byModule}
              modules={modules}
              selected={selected}
              disabled={role?.is_system}
              onToggle={toggle}
              onToggleModule={toggleModule}
            />
          </div>
        </div>

        {role?.is_system && (
          <p className="rounded-md border border-amber-600/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            {t('roles.systemLocked')}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={methods.formState.isSubmitting || role?.is_system}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
