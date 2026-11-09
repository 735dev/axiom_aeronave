import { useMemo, useState } from 'react';
import { useAuditLog } from '../hooks/useAudit';
import { AuditTimeline } from '../components/AuditTimeline';
import { AuditAction, AuditEntity, AuditFilters } from '../types/audit.types';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';

const ACTIONS: AuditAction[] = [
  'create',
  'update',
  'status_change',
  'decision',
  'comment',
  'permission_change',
  'login',
  'login_failed',
  'denied',
];

const ENTITIES: AuditEntity[] = ['ticket', 'user', 'role', 'ticket_type', 'catalog', 'reconciliation', 'session'];

export function AuditPage() {
  const t = useT();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [applied, setApplied] = useState<AuditFilters>({});
  const filters = useMemo(() => applied, [applied]);
  const { items, isLoading, total, page, links, setPage } = useAuditLog(filters);

  const set = (patch: Partial<AuditFilters>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold">{t('audit.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1.5">{t('audit.search')}</Label>
            <Input
              value={draft.search ?? ''}
              onChange={(e) => set({ search: e.target.value })}
              placeholder={t('audit.searchHint')}
            />
          </div>
          <div>
            <Label className="mb-1.5">{t('audit.entity')}</Label>
            <Select
              value={draft.entity ?? ''}
              onChange={(e) => set({ entity: (e.target.value || undefined) as AuditEntity })}
            >
              <option value="">{t('common.all')}</option>
              {ENTITIES.map((entity) => (
                <option key={entity} value={entity}>
                  {t(`audit.entities.${entity}`)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5">{t('audit.action')}</Label>
            <Select
              value={draft.action ?? ''}
              onChange={(e) => set({ action: (e.target.value || undefined) as AuditAction })}
            >
              <option value="">{t('common.all')}</option>
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {t(`audit.actions.${action}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1.5">{t('audit.from')}</Label>
              <Input
                type="date"
                value={draft.from ?? ''}
                onChange={(e) => set({ from: e.target.value || undefined })}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t('audit.to')}</Label>
              <Input
                type="date"
                value={draft.to ?? ''}
                onChange={(e) => set({ to: e.target.value || undefined })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setApplied(draft)}>
            {t('audit.apply')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft({});
              setApplied({});
            }}
          >
            {t('audit.clear')}
          </Button>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            <span className="data">{total}</span> {t('audit.events')}
          </span>
        </div>
      </Card>

      <Card className="p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <AuditTimeline events={items} showEntity emptyLabel={t('audit.empty')} />
        )}
      </Card>

      {(links.next || page > 1) && (
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('audit.previous')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!links.next}
            onClick={() => setPage(page + 1)}
          >
            {t('audit.next')}
          </Button>
        </div>
      )}
    </section>
  );
}
