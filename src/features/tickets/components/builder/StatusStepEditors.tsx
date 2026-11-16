import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { FieldDef, StatusAdvanceRule, StatusDef, StepDef } from '../../types/ticket.types';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { useT } from '@/shared/hooks/useT';

const COLORS: StatusDef['color'][] = ['default', 'info', 'warning', 'danger', 'success'];

interface RoleOption {
  id: string;
  name: string;
}

interface RowProps {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}

function Row({ index, total, onMove, onRemove, children }: RowProps) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex justify-end gap-1">
        <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
      {children}
    </div>
  );
}

interface StatusProps {
  status: StatusDef;
  index: number;
  total: number;
  steps: StepDef[];
  fields: FieldDef[];
  onChange: (status: StatusDef) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

function defaultEquals(field: FieldDef): StatusAdvanceRule['equals'] {
  if (field.type === 'checkbox') return false;
  const first = field.options?.[0];
  if (first) return first.value;
  return '';
}

function EqualsControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef | undefined;
  value: StatusAdvanceRule['equals'];
  onChange: (equals: StatusAdvanceRule['equals']) => void;
}) {
  const t = useT();
  if (field?.type === 'checkbox') {
    return (
      <Select
        className="sm:col-span-2"
        aria-label={t('ticketTypes.advanceEquals')}
        value={value === true ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">{t('ticketTypes.advanceYes')}</option>
        <option value="false">{t('ticketTypes.advanceNo')}</option>
      </Select>
    );
  }
  if (field?.options?.length) {
    const current = value == null ? '' : String(value);
    return (
      <Select
        className="sm:col-span-2"
        aria-label={t('ticketTypes.advanceEquals')}
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {current && !field.options.some((option) => option.value === current) && (
          <option value={current}>{current}</option>
        )}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }
  const numeric = field && (field.type === 'number' || field.type === 'integer' || field.type === 'money');
  return (
    <Input
      className="sm:col-span-2"
      aria-label={t('ticketTypes.advanceEquals')}
      placeholder={t('ticketTypes.advanceEquals')}
      value={value == null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (!numeric) {
          onChange(raw);
          return;
        }
        onChange(raw === '' ? '' : Number(raw));
      }}
    />
  );
}

export function StatusEditor({
  status,
  index,
  total,
  steps,
  fields,
  onChange,
  onRemove,
  onMove,
}: StatusProps) {
  const t = useT();
  const set = (patch: Partial<StatusDef>) => onChange({ ...status, ...patch });
  const rules = status.advance_rules ?? [];
  const allRequired = rules.some((rule) => rule.when === 'all_required');
  const stepRules = rules.filter((rule) => rule.when !== 'all_required');
  const stepOptions = steps.filter((step) => step.code);

  const writeRules = (nextSteps: StatusAdvanceRule[], all: boolean) => {
    const next = [...(all ? [{ when: 'all_required' as const }] : []), ...nextSteps];
    set({ advance_rules: next.length ? next : undefined });
  };

  const patchRule = (ruleIndex: number, patch: Partial<StatusAdvanceRule>) => {
    writeRules(
      stepRules.map((rule, i) => (i === ruleIndex ? { ...rule, ...patch } : rule)),
      allRequired,
    );
  };

  return (
    <Row index={index} total={total} onMove={onMove} onRemove={onRemove}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={status.name}
          placeholder={t('ticketTypes.statusName')}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Select
          value={status.color}
          onChange={(e) => set({ color: e.target.value as StatusDef['color'] })}
        >
          {COLORS.map((color) => (
            <option key={color} value={color}>
              {t(`ticketTypes.color.${color}`)}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={status.is_initial}
            onChange={(e) => set({ is_initial: e.target.checked })}
          />
          {t('ticketTypes.isInitial')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={status.is_final}
            onChange={(e) => set({ is_final: e.target.checked })}
          />
          {t('ticketTypes.isFinal')}
        </label>
      </div>
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">{t('ticketTypes.advanceHint')}</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={allRequired}
            onChange={(e) => writeRules(stepRules, e.target.checked)}
          />
          {t('ticketTypes.advanceAll')}
        </label>
        {stepRules.map((rule, ruleIndex) => {
          const field = fields.find((item) => item.key === rule.field_key);
          return (
            <div key={`${rule.step_code ?? 'step'}-${ruleIndex}`} className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <Label>{t('ticketTypes.advanceStep')}</Label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => writeRules(stepRules.filter((_, i) => i !== ruleIndex), allRequired)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <Select
                value={rule.step_code ?? ''}
                onChange={(e) => patchRule(ruleIndex, { step_code: e.target.value || undefined })}
              >
                {rule.step_code && !stepOptions.some((step) => step.code === rule.step_code) && (
                  <option value={rule.step_code}>{rule.step_code}</option>
                )}
                {stepOptions.map((step) => (
                  <option key={step.code} value={step.code}>
                    {step.name || step.code}
                  </option>
                ))}
              </Select>
              <Select
                value={rule.field_key ?? ''}
                onChange={(e) => {
                  const key = e.target.value;
                  const nextField = fields.find((item) => item.key === key);
                  patchRule(ruleIndex, {
                    field_key: key || undefined,
                    equals: nextField ? defaultEquals(nextField) : undefined,
                  });
                }}
              >
                <option value="">{t('ticketTypes.advanceFieldNone')}</option>
                {rule.field_key && !fields.some((item) => item.key === rule.field_key) && (
                  <option value={rule.field_key}>{rule.field_key}</option>
                )}
                {fields
                  .filter((item) => item.key)
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label || item.key}
                    </option>
                  ))}
              </Select>
              {rule.field_key && (
                <EqualsControl
                  field={field}
                  value={rule.equals}
                  onChange={(equals) => patchRule(ruleIndex, { equals })}
                />
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={Boolean(rule.only_this_step)}
                  onChange={(e) => patchRule(ruleIndex, { only_this_step: e.target.checked })}
                />
                {t('ticketTypes.advanceOnly')}
              </label>
            </div>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={stepOptions.length === 0}
          onClick={() =>
            writeRules(
              [...stepRules, { when: 'step', step_code: stepOptions[0]?.code, only_this_step: false }],
              allRequired,
            )
          }
        >
          <Plus className="h-4 w-4" />
          {t('ticketTypes.advanceAdd')}
        </Button>
      </div>
    </Row>
  );
}

interface StepProps {
  step: StepDef;
  index: number;
  total: number;
  roles: RoleOption[];
  onChange: (step: StepDef) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function StepEditor({ step, index, total, roles, onChange, onRemove, onMove }: StepProps) {
  const t = useT();
  const set = (patch: Partial<StepDef>) => onChange({ ...step, ...patch });

  return (
    <Row index={index} total={total} onMove={onMove} onRemove={onRemove}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          value={step.name}
          placeholder={t('ticketTypes.stepName')}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Select value={step.role_id ?? ''} onChange={(e) => set({ role_id: e.target.value || undefined })}>
          <option value="">{t('tickets.anyRole')}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={step.required}
            onChange={(e) => set({ required: e.target.checked })}
          />
          {t('ticketTypes.stepRequired')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="step-requires-signature"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={step.requires_signature ?? false}
            onChange={(e) => set({ requires_signature: e.target.checked })}
          />
          {t('ticketTypes.stepRequiresSignature')}
        </label>
      </div>
    </Row>
  );
}
