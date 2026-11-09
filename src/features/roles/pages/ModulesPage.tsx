import { useState } from 'react';
import { KeyRound, Layers } from 'lucide-react';
import { usePermissionCatalog } from '../hooks/useRoles';
import { ModuleForm } from '../components/ModuleForm';
import { Module } from '../types/role.types';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { AdminTabs } from '@/shared/components/layout/AdminTabs';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

export function ModulesPage() {
  const t = useT();
  const { modules, isLoading, reload } = usePermissionCatalog();
  const [editing, setEditing] = useState<Module | null>(null);

  return (
    <section className="space-y-5 p-4 md:p-6">
      <AdminTabs section="access" />

      <header>
        <h1 className="text-2xl font-extrabold">{t('modules.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('modules.subtitle')}</p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((module) => (
          <Card key={module.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  {module.name}
                </p>
                <code className="mt-0.5 block text-xs text-muted-foreground">{module.code}</code>
                {module.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" />
                {module.permissions_count} {t('roles.permissionsShort')}
              </span>
              {module.show_in_menu && module.route ? (
                <Badge variant="success">{t('modules.inMenu')}</Badge>
              ) : (
                <Badge>{t('modules.hidden')}</Badge>
              )}
              {module.route && <code className={cn('text-xs')}>{module.route}</code>}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setEditing(module)}
            >
              {t('modules.menuConfig')}
            </Button>
          </Card>
        ))}
      </div>

      <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {t('modules.routeHint')}
      </p>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editing && (
              <ModuleForm module={editing} onSuccess={reload} onClose={() => setEditing(null)} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
