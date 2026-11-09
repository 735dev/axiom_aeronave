import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CatalogItemInput, catalogItemSchema } from '../schemas/catalogSchema';
import { createCatalogItem } from '../api/catalogsApi';
import { CatalogKey } from '../types/catalog.types';
import { FormInput } from '@/shared/components/form/FormInput';
import { Button } from '@/shared/components/ui/button';
import { applyServerErrors } from '@/shared/utils/applyServerErrors';
import { notify } from '@/shared/utils/notify';
import { useT } from '@/shared/hooks/useT';

interface Props {
  catalog: CatalogKey;
  onSuccess: () => void;
  onClose: () => void;
}

export function CatalogItemForm({ catalog, onSuccess, onClose }: Props) {
  const t = useT();
  const methods = useForm<CatalogItemInput>({
    resolver: zodResolver(catalogItemSchema),
    defaultValues: { name: '', code: '', extra: '' },
  });

  const onSubmit = async (input: CatalogItemInput) => {
    const res = await createCatalogItem({
      catalog,
      name: input.name,
      code: input.code || undefined,
      extra: input.extra || undefined,
    });
    if (res.ok) {
      notify.toast.success(t('catalogs.createdOk'));
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
        <FormInput<CatalogItemInput> name="name" label="catalogs.fields.name" />
        <FormInput<CatalogItemInput> name="code" label="catalogs.fields.code" />
        <p className="text-xs text-muted-foreground">{t('catalogs.codeHint')}</p>
        <FormInput<CatalogItemInput> name="extra" label="catalogs.fields.extra" />
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
