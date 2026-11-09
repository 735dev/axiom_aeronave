import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { StatusDef, StepDef } from '../../types/ticket.types';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
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
  onChange: (status: StatusDef) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function StatusEditor({ status, index, total, onChange, onRemove, onMove }: StatusProps) {
  const t = useT();
  const set = (patch: Partial<StatusDef>) => onChange({ ...status, ...patch });

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
      </div>
    </Row>
  );
}
