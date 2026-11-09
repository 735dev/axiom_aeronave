import { useState } from 'react';
import { Flag, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTicketTypes } from '../hooks/useTickets';
import { updateTicketType } from '../api/ticketsApi';
import { StatusDef, TicketType } from '../types/ticket.types';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

const COLORS: StatusDef['color'][] = ['default', 'info', 'warning', 'danger', 'success'];

export function StatusesPanel() {
  const t = useT();
  const { types, isLoading, reload } = useTicketTypes();
  const [editing, setEditing] = useState<TicketType | null>(null);
  const [draft, setDraft] = useState<StatusDef[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);

  const open = (type: TicketType) => {
    setEditing(type);
    setDraft(type.statuses.map((s) => ({ ...s })));
  };

  const save = async () => {
    if (!editing) return;
    if (draft.filter((s) => s.name.trim()).length === 0) {
      notify.toast.error(t('ticketTypes.needsStatus'));
      return;
    }
    setSubmitting(true);
    const res = await updateTicketType(editing.id, { statuses: draft });
    setSubmitting(false);
    if (res.ok) {
      notify.toast.success(t('statuses.savedOk'));
      setEditing(null);
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  const set = (index: number, patch: Partial<StatusDef>) =>
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {t('statuses.title')}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('statuses.subtitle')}</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <div className="space-y-3">
        {types.map((type) => (
          <Card key={type.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {type.name}
                  {type.is_root && <Badge variant="warning">{t('ticketTypes.rootBadge')}</Badge>}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...type.statuses]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((status) => (
                      <Badge key={status.id} variant={status.color}>
                        {status.name}
                        {status.is_initial && ` · ${t('statuses.initialShort')}`}
                        {status.is_final && ` · ${t('statuses.finalShort')}`}
                      </Badge>
                    ))}
                </div>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => open(type)}>
                {t('statuses.edit')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((prev) => [
                  ...prev,
                  {
                    id: `s-new-${prev.length + 1}`,
                    code: '',
                    name: '',
                    color: 'default',
                    sort_order: prev.length + 1,
                    is_initial: prev.length === 0,
                    is_final: false,
                    counts_as_committed: true,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              {t('ticketTypes.addStatus')}
            </Button>

            {draft.map((status, index) => (
              <div key={status.id} className="rounded-lg border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={status.name}
                    placeholder={t('ticketTypes.statusName')}
                    onChange={(e) => set(index, { name: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Select
                      value={status.color}
                      onChange={(e) => set(index, { color: e.target.value as StatusDef['color'] })}
                    >
                      {COLORS.map((color) => (
                        <option key={color} value={color}>
                          {t(`ticketTypes.color.${color}`)}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setDraft((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={status.is_initial}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((s, i) => ({ ...s, is_initial: i === index })),
                        )
                      }
                    />
                    <Flag className="h-3.5 w-3.5" />
                    {t('ticketTypes.isInitial')}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={status.is_final}
                      onChange={(e) => set(index, { is_final: e.target.checked })}
                    />
                    {t('ticketTypes.isFinal')}
                  </label>
                </div>
              </div>
            ))}

            <div className="flex gap-3 border-t border-border pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" disabled={isSubmitting} onClick={() => void save()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
