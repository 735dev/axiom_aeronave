import { useState } from 'react';
import { usePermissionCatalog } from '../hooks/useRoles';
import { PermissionsTree } from '../components/PermissionsTree';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { useT } from '@/shared/hooks/useT';

export function PermissionsPage() {
  const t = useT();
  const { modules, byModule, isLoading } = usePermissionCatalog();
  const [query, setQuery] = useState('');

  return (
    <section className="space-y-5 p-4 md:p-6">
      <AdminTabs section="access" />

      <header>
        <h1 className="text-2xl font-extrabold">{t('permissions.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
      </header>

      <Input
        placeholder={t('permissions.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <Card>
        <PermissionsTree modules={modules} byModule={byModule} query={query} />
      </Card>

      <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {t('permissions.readOnlyNote')}
      </p>
    </section>
  );
}
