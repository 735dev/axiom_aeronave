import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserInput, userSchema } from '../schemas/userSchema';
import { createUser, updateUser } from '../api/usersApi';
import { AppUser } from '../types/user.types';
import { getRoleOptions } from '@/shared/auth/accessApi';
import { useCatalogOptions } from '@/features/catalogs/hooks/useCatalog';
import { FormInput } from '@/shared/components/form/FormInput';
import { FormImageInput } from '@/shared/components/form/FormImageInput';
import { initials } from '@/shared/utils/initials';
import { FormSelect, SelectOption } from '@/shared/components/form/FormSelect';
import { Button } from '@/shared/components/ui/button';
import { applyServerErrors } from '@/shared/utils/applyServerErrors';
import { notify } from '@/shared/utils/notify';
import { useT } from '@/shared/hooks/useT';

interface Props {
  user?: AppUser | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function UserForm({ user, onSuccess, onClose }: Props) {
  const t = useT();
  const [roleOptions, setRoleOptions] = useState<SelectOption[]>([]);
  const locationOptions = useCatalogOptions('locations');
  const aircraftOptions = useCatalogOptions('aircrafts');

  const methods = useForm<UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      avatar_url: user?.avatar_url ?? '',
      role_id: user?.role_id ?? '',
      location: user?.location ?? '',
      aircraft_id: user?.aircraft_id ?? '',
    },
  });

  useEffect(() => {
    void getRoleOptions().then((res) => {
      if (!res.ok) return;
      const options = res.data.map((r) => ({ value: r.id, label: r.name }));
      setRoleOptions(options);
      if (!user && options[0]) methods.setValue('role_id', String(options[0].value));
    });
  }, [methods, user]);

  const onSubmit = async (input: UserInput) => {
    const payload = {
      ...input,
      phone: input.phone || undefined,
      avatar_url: input.avatar_url ?? '',
      location: input.location || undefined,
      aircraft_id: input.aircraft_id || undefined,
    };
    const res = user ? await updateUser(user.id, payload) : await createUser(payload);
    if (res.ok) {
      notify.success(user ? 'users.updatedOk' : 'users.createdOk', user ? 200 : 201);
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
        <FormImageInput<UserInput>
          name="avatar_url"
          label="users.fields.photo"
          fallback={initials(methods.watch('full_name'))}
        />
        <FormInput<UserInput> name="full_name" label="users.fields.fullName" />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput<UserInput> name="email" type="email" label="users.fields.email" />
          <FormInput<UserInput> name="phone" label="users.fields.phone" />
        </div>
        <FormSelect<UserInput> name="role_id" label="users.fields.role" options={roleOptions} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormSelect<UserInput>
            name="location"
            label="users.fields.location"
            options={[{ value: '', label: 'common.optional' }, ...locationOptions]}
          />
          <FormSelect<UserInput>
            name="aircraft_id"
            label="users.fields.aircraft"
            options={[{ value: '', label: 'common.optional' }, ...aircraftOptions]}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('users.aircraftHint')}</p>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="flex-1" disabled={methods.formState.isSubmitting}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
