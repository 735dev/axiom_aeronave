import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { createRule, getRules, updateRule } from '../api/ticketsApi';
import { useTicketTypes } from '../hooks/useTickets';
import { BusinessRule, RuleAction, RuleField, RuleOperator } from '../types/ticket.types';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

const FIELDS: RuleField[] = ['amount_base', 'concept', 'attachments', 'amount_vs_route'];

/** `CCS-PZO=1200` por línea <-> mapa de topes por ruta. */
export function parseRouteLimits(text: string): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z0-9]+-[A-Za-z0-9]+)\s*=\s*(\d+(?:[.,]\d+)?)\s*$/.exec(line);
    if (m) out[m[1]!.toUpperCase()] = Number(m[2]!.replace(',', '.'));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function formatRouteLimits(limits?: Record<string, number>): string {
  return Object.entries(limits ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}
const OPERATORS: RuleOperator[] = ['gt', 'lt', 'eq', 'missing'];
const ACTIONS: RuleAction[] = ['require_authorization', 'require_support', 'warn'];

const EMPTY = {
  name: '',
  type_code: '',
  field: 'amount_base' as RuleField,
  operator: 'gt' as RuleOperator,
  value: '',
  action: 'warn' as RuleAction,
  message: '',
  limits: '',
};

/** Las reglas de negocio se declaran acá, sin pasar por desarrollo. */
export function RulesPage() {
  const t = useT();
  const { types } = useTicketTypes({ is_active: true });
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getRules();
    if (res.ok) setRules(res.data);
    else notify.fromApiError(res);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (rule: BusinessRule) => {
    const res = await updateRule(rule.id, { is_active: !rule.is_active });
    if (res.ok) void load();
    else notify.fromApiError(res);
  };

  const save = async () => {
    if (!draft.name || !draft.type_code || !draft.message) {
      notify.toast.error(t('rules.incomplete'));
      return;
    }
    const { limits, ...rest } = draft;
    const isRoute = draft.field === 'amount_vs_route';
    if (isRoute && !parseRouteLimits(limits)) {
      notify.toast.error(t('rules.limitsInvalid'));
      return;
    }
    const data = {
      ...rest,
      value: draft.operator === 'missing' || isRoute ? undefined : draft.value,
      route_limits: isRoute ? parseRouteLimits(limits) : undefined,
    };
    const res = editingId ? await updateRule(editingId, data) : await createRule(data);
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    notify.toast.success(t(editingId ? 'rules.updated' : 'rules.created'));
    setDraft(EMPTY);
    setEditingId(null);
    setCreating(false);
    void load();
  };

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('rules.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('rules.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{t('rules.new')}</Button>
      </header>

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {rule.is_active ? (
                    <ShieldCheck className="h-4 w-4 text-success" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  )}
                  {rule.name}
                  {!rule.is_active && <Badge>{t('rules.inactive')}</Badge>}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{rule.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="info">
                    {types.find((x) => x.code === rule.type_code)?.name ?? rule.type_code}
                  </Badge>
                  <span className="data text-xs text-muted-foreground">
                    {rule.field === 'amount_vs_route'
                      ? formatRouteLimits(rule.route_limits).replace(/\n/g, ' · ')
                      : `${t(`rules.fields.${rule.field}`)} ${t(`rules.operators.${rule.operator}`)} ${rule.value ?? ''}`}
                  </span>
                  <Badge variant={rule.action === 'warn' ? 'warning' : 'danger'}>
                    {t(`rules.actions.${rule.action}`)}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(rule.id);
                    setDraft({
                      name: rule.name,
                      type_code: rule.type_code,
                      field: rule.field,
                      operator: rule.operator,
                      value: String(rule.value ?? ''),
                      action: rule.action,
                      message: rule.message,
                      limits: formatRouteLimits(rule.route_limits),
                    });
                    setCreating(true);
                  }}
                >
                  {t('common.edit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggle(rule)}>
                  {rule.is_active ? t('rules.disable') : t('rules.enable')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={creating}
        onOpenChange={(v) => {
          setCreating(v);
          if (!v) {
            setEditingId(null);
            setDraft(EMPTY);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(editingId ? 'rules.edit' : 'rules.new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="mb-1.5">{t('rules.name')}</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t('rules.type')}</Label>
              <Select
                value={draft.type_code}
                onChange={(e) => setDraft({ ...draft, type_code: e.target.value })}
              >
                <option value="">{t('common.optional')}</option>
                {types.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1.5">{t('rules.field')}</Label>
                <Select
                  value={draft.field}
                  onChange={(e) => setDraft({ ...draft, field: e.target.value as RuleField })}
                >
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {t(`rules.fields.${f}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">{t('rules.operator')}</Label>
                <Select
                  value={draft.operator}
                  onChange={(e) =>
                    setDraft({ ...draft, operator: e.target.value as RuleOperator })
                  }
                >
                  {OPERATORS.map((o) => (
                    <option key={o} value={o}>
                      {t(`rules.operators.${o}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">{t('rules.value')}</Label>
                <Input
                  className="data"
                  disabled={draft.operator === 'missing'}
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              </div>
            </div>
            {draft.field === 'amount_vs_route' && (
              <div>
                <Label className="mb-1.5">{t('rules.limits')}</Label>
                <textarea
                  className="data min-h-20 w-full rounded-md border border-border bg-background p-2 text-sm"
                  placeholder="CCS-PZO=1200"
                  value={draft.limits}
                  onChange={(e) => setDraft({ ...draft, limits: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('rules.limitsHint')}</p>
              </div>
            )}
            <div>
              <Label className="mb-1.5">{t('rules.action')}</Label>
              <Select
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value as RuleAction })}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {t(`rules.actions.${a}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">{t('rules.message')}</Label>
              <Input
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={() => void save()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
