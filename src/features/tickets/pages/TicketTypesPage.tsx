import { useState } from 'react';
import { LayoutList, Lock, Plus, Trash2 } from 'lucide-react';
import { useTicketTypes } from '../hooks/useTickets';
import { TicketTypeForm } from '../components/builder/TicketTypeForm';
import { deleteTicketType, updateTicketType } from '../api/ticketsApi';
import { TicketType } from '../types/ticket.types';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

export function TicketTypesPanel() {
  const t = useT();
  const { types, isLoading, reload } = useTicketTypes();
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [creating, setCreating] = useState(false);

  const onToggle = async (type: TicketType) => {
    const res = await updateTicketType(type.id, { is_active: !type.is_active });
    if (res.ok) {
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  const onDelete = (type: TicketType) => {
    notify.confirm('ticketTypes.confirmDelete', async () => {
      const res = await deleteTicketType(type.id);
      if (res.ok) {
        notify.toast.success(t('ticketTypes.deletedOk'));
        void reload();
        return;
      }
      notify.fromApiError(res);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <LayoutList className="h-4 w-4 text-muted-foreground" />
            {t('ticketTypes.title')}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('ticketTypes.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t('ticketTypes.new')}
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <div className="space-y-3">
        {types.map((type) => (
          <Card key={type.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className={cn('flex flex-wrap items-center gap-2 font-medium', !type.is_active && 'text-muted-foreground line-through')}>
                  {type.name}
                  {type.is_system && (
                    <Badge variant="info">
                      <Lock className="mr-1 h-3 w-3" />
                      {t('catalogs.system')}
                    </Badge>
                  )}
                  {type.is_root && <Badge variant="warning">{t('ticketTypes.rootBadge')}</Badge>}
                  {type.blocks_parent_close && (
                    <Badge variant="warning">{t('ticketTypes.blocking')}</Badge>
                  )}
                </p>
                {type.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LayoutList className="h-3.5 w-3.5" />
                    {type.fields.length} {t('ticketTypes.fieldsShort')}
                  </span>
                  <span>
                    {type.statuses.length} {t('ticketTypes.statusesShort')}
                  </span>
                  <span>
                    · {type.steps.length} {t('ticketTypes.stepsShort')}
                  </span>
                  {type.default_role_name && <span>· {type.default_role_name}</span>}
                  <span>· {type.tickets_count} {t('ticketTypes.ticketsShort')}</span>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(type)}>
                  {t('ticketTypes.editForm')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onToggle(type)}>
                  {type.is_active ? t('catalogs.disable') : t('catalogs.enable')}
                </Button>
                {!type.is_system && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(type)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={creating || Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : t('ticketTypes.new')}</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            <TicketTypeForm
              type={editing}
              allTypes={types}
              onSuccess={reload}
              onClose={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
