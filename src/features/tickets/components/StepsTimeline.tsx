import { useState } from 'react';
import { Check, CircleSlash, X } from 'lucide-react';
import { Decision, DecisionValue, FieldDef, StepDef } from '../types/ticket.types';
import { DynamicValues } from '../schemas/dynamicSchema';
import { decideStep } from '../api/ticketsApi';
import { blockedByEarlierRoleStep, groupStepFields } from '../utils/stepFields';
import { StepFields } from './StepFields';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

const ICONS: Record<DecisionValue, typeof Check> = {
  done: Check,
  rejected: X,
  not_applicable: CircleSlash,
};

interface Props {
  ticketId: string;
  steps: StepDef[];
  decisions: Decision[];
  fields: FieldDef[];
  payload: DynamicValues;
  canDecide: boolean;
  /** Permite registrar decisiones de pasos que corresponden a otro rol. */
  canDecideAny: boolean;
  serverErrors?: Record<string, string>;
  /** Guarda solo los datos del paso. El registro del paso lo hace esta línea de tiempo. */
  onSave: (values: DynamicValues) => Promise<boolean>;
  onDecided: () => void;
}

export function StepsTimeline({
  ticketId,
  steps,
  decisions,
  fields,
  payload,
  canDecide,
  canDecideAny,
  serverErrors,
  onSave,
  onDecided,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const [active, setActive] = useState<StepDef | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionValue>('done');
  const [observation, setObservation] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
  const fieldsByStep = groupStepFields(fields, steps);
  const canAct = (step: StepDef) => {
    const isMine = !step.role_id || step.role_id === user?.role_id;
    return canDecide && (isMine || canDecideAny);
  };
  const decided = new Set(decisions.map((item) => item.step_code));
  const firstWithFields = sorted.find(
    (step) =>
      canAct(step) &&
      !decided.has(step.code) &&
      (fieldsByStep.get(step.code)?.length ?? 0) > 0,
  );
  const openCode = opened ?? firstWithFields?.code ?? null;

  const submit = async () => {
    if (!active) return;
    setSubmitting(true);
    const res = await decideStep(ticketId, { step_code: active.code, decision, observation });
    setSubmitting(false);
    if (res.ok) {
      notify.toast.success(t('tickets.decisionSaved'));
      setActive(null);
      setObservation('');
      onDecided();
      return;
    }
    notify.fromApiError(res);
  };

  const submitFields = async (step: StepDef, values: DynamicValues) => {
    setSubmitting(true);
    const saved = await onSave(values);
    if (!saved) {
      setSubmitting(false);
      return;
    }
    const previous = decisions.find((item) => item.step_code === step.code);
    const res = await decideStep(ticketId, {
      step_code: step.code,
      decision: previous?.decision ?? 'done',
      observation: previous?.observation,
    });
    setSubmitting(false);
    onDecided();
    if (res.ok) {
      notify.toast.success(t('tickets.decisionSaved'));
      setOpened(null);
      return;
    }
    notify.fromApiError(res);
  };

  return (
    <>
      <ol className="divide-y divide-border">
        {sorted.map((step, index) => {
          const taken = decisions.find((d) => d.step_code === step.code);
          const Icon = taken ? ICONS[taken.decision] : null;
          const allowed = canAct(step);
          const stepFields = fieldsByStep.get(step.code) ?? [];
          const isLater = !taken && blockedByEarlierRoleStep(step, sorted, decided, canAct);
          const showingForm = openCode === step.code && stepFields.length > 0 && allowed && !isLater;

          return (
            <li key={step.id} className="py-3">
              <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]',
                  taken?.decision === 'done' && 'border-success/30 bg-success/10 text-success',
                  taken?.decision === 'rejected' &&
                    'border-destructive/40 bg-destructive/10 text-destructive',
                  taken?.decision === 'not_applicable' && 'border-border bg-muted text-muted-foreground',
                  !taken && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {step.name}
                  {!step.required && (
                    <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {taken
                    ? `${t(`tickets.decision.${taken.decision}`)} · ${taken.decided_by} · ${formatDateTime(taken.decided_at)}`
                    : (step.responsible_area ?? step.role_name ?? t('tickets.anyRole'))}
                </p>

                {taken?.signed && !taken.signature_url && (
                  <p
                    data-testid="step-signed"
                    className="mt-1.5 text-[10px] font-medium uppercase tracking-strip text-success"
                  >
                    {t('closing.stepSigned')}
                  </p>
                )}
                {taken?.signature_url && (
                  <figure className="mt-1.5 inline-flex flex-col items-start gap-1 rounded-lg border border-border bg-white p-2">
                    <img
                      src={taken.signature_url}
                      alt={`${t('users.signatureOf')} ${taken.decided_by}`}
                      className="h-10 w-auto max-w-[180px] object-contain"
                    />
                    <figcaption className="text-[10px] uppercase tracking-strip text-neutral-500">
                      {taken.decided_by}
                    </figcaption>
                  </figure>
                )}
                {taken?.observation && (
                  <p className="mt-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs">
                    {taken.observation}
                  </p>
                )}
              </div>

              {allowed && !showingForm && !isLater && (
                <Button
                  size="sm"
                  variant={taken ? 'ghost' : 'outline'}
                  className="shrink-0"
                  onClick={() => {
                    if (stepFields.length > 0) {
                      setOpened(step.code);
                      return;
                    }
                    setActive(step);
                    setDecision(taken?.decision ?? 'done');
                    setObservation(taken?.observation ?? '');
                  }}
                >
                  {taken
                    ? t('common.edit')
                    : canDecideAny && step.role_id && step.role_id !== user?.role_id
                      ? t('tickets.decideAsAdmin')
                      : t('tickets.decide')}
                </Button>
              )}
              </div>
              {stepFields.length > 0 &&
                (showingForm ? (
                  <div className="pl-10">
                    <StepFields
                      fields={stepFields}
                      payload={payload}
                      readOnly={false}
                      showPhotoHint={stepFields.some((field) => field.type === 'file')}
                      isSubmitting={isSubmitting}
                      serverErrors={serverErrors}
                      onSubmit={(values) => void submitFields(step, values)}
                    />
                  </div>
                ) : (
                  <div className="pl-10">
                    <StepFields fields={stepFields} payload={payload} readOnly onSubmit={() => undefined} />
                  </div>
                ))}
            </li>
          );
        })}
      </ol>

      <Dialog open={Boolean(active)} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="mb-1.5 block">{t('tickets.decisionLabel')}</Label>
              <Select value={decision} onChange={(e) => setDecision(e.target.value as DecisionValue)}>
                <option value="done">{t('tickets.decision.done')}</option>
                <option value="rejected">{t('tickets.decision.rejected')}</option>
                <option value="not_applicable">{t('tickets.decision.not_applicable')}</option>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t('tickets.observation')}</Label>
              <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setActive(null)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" disabled={isSubmitting} onClick={() => void submit()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
