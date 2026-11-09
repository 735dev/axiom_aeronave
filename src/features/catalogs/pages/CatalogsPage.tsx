import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Lock, Plus, Trash2 } from 'lucide-react';
import { useCatalogDefinitions, useCatalogItems } from '../hooks/useCatalog';
import { CatalogItemForm } from '../components/CatalogItemForm';
import { deleteCatalogItem, updateCatalogItem } from '../api/catalogsApi';
import { CatalogItem, CatalogKey } from '../types/catalog.types';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Can } from '@/shared/components/auth/Can';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

export function CatalogListPanel() {
  const t = useT();
  const { definitions, reload: reloadDefinitions } = useCatalogDefinitions();
  const [params] = useSearchParams();
  const active = (params.get('tipo') as CatalogKey) ?? 'expense_concepts';
  const items = useCatalogItems(active);
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    void items.reload();
    void reloadDefinitions();
  };

  const onToggle = async (item: CatalogItem) => {
    const res = await updateCatalogItem(item.id, { is_active: !item.is_active });
    if (res.ok) {
      refresh();
      return;
    }
    notify.fromApiError(res);
  };

  const onDelete = (item: CatalogItem) => {
    notify.confirm('catalogs.confirmDelete', async () => {
      const res = await deleteCatalogItem(item.id);
      if (res.ok) {
        notify.toast.success(t('catalogs.deletedOk'));
        refresh();
        return;
      }
      notify.fromApiError(res);
    });
  };

  const current = definitions.find((d) => d.key === active);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <Database className="h-4 w-4 text-muted-foreground" />
            {current?.name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{current?.description}</p>
        </div>
        <Can permission={PERMISSIONS.catalogsManage}>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('catalogs.new')}
          </Button>
        </Can>
      </div>

      <ul className="divide-y divide-border">
          {items.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-3"
            >
              <div className="min-w-0">
                <p className={cn('text-sm', !item.is_active && 'text-muted-foreground line-through')}>
                  {item.name}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <code>{item.code}</code>
                  {item.extra && <span>· {item.extra}</span>}
                  {item.is_system && (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {t('catalogs.system')}
                    </span>
                  )}
                </p>
              </div>
              <Can permission={PERMISSIONS.catalogsManage}>
                <div className="-ml-3 flex items-center gap-1 lg:ml-0 lg:shrink-0 lg:gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void onToggle(item)}>
                    {item.is_active ? t('catalogs.disable') : t('catalogs.enable')}
                  </Button>
                  {!item.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => onDelete(item)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Can>
            </li>
          ))}
          {items.items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('common.empty')}
            </li>
          )}
      </ul>

      <p className="border-t border-border p-4 text-xs text-muted-foreground">
        <Badge variant="info">{t('catalogs.system')}</Badge> {t('catalogs.systemHint')}
      </p>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{current?.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <CatalogItemForm
              catalog={active}
              onSuccess={refresh}
              onClose={() => setCreating(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
