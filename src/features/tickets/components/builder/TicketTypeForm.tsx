import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { FieldEditor } from './FieldEditor';
import { StatusEditor, StepEditor } from './StatusStepEditors';
import { createTicketType, updateTicketType } from '../../api/ticketsApi';
import { FieldDef, StatusDef, StepDef, TicketType } from '../../types/ticket.types';
import { getPermissionOptions, getRoleOptions, PermissionOption, RoleOption } from '@/shared/auth/accessApi';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

type Tab = 'data' | 'fields' | 'statuses' | 'steps';

interface Props {
  type?: TicketType | null;
  allTypes: TicketType[];
  onSuccess: () => void;
  onClose: () => void;
}

const uid = (prefix: string, index: number) => `${prefix}-new-${index}-${index * 7}`;

export function TicketTypeForm({ type, allTypes, onSuccess, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('data');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);

  const [name, setName] = useState(type?.name ?? '');
  const [description, setDescription] = useState(type?.description ?? '');
  const [isRoot, setIsRoot] = useState(type?.is_root ?? false);
  const [childCodes, setChildCodes] = useState<string[]>(type?.child_type_codes ?? []);
  const [roleId, setRoleId] = useState(type?.default_role_id ?? '');
  const [blocks, setBlocks] = useState(type?.blocks_parent_close ?? false);
  const [fields, setFields] = useState<FieldDef[]>(type?.fields ?? []);
  const [statuses, setStatuses] = useState<StatusDef[]>(type?.statuses ?? []);
  const [steps, setSteps] = useState<StepDef[]>(type?.steps ?? []);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getRoleOptions().then((res) => {
      if (res.ok) setRoles(res.data);
    });
    void getPermissionOptions().then((res) => {
      if (res.ok) setPermissions(res.data);
    });
  }, []);

  function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    return copy;
  }

  const onSubmit = async () => {
    if (name.trim().length < 3) {
      notify.toast.error(t('ticketTypes.needsName'));
      return;
    }
    if (fields.filter((f) => f.label.trim()).length === 0) {
      notify.toast.error(t('ticketTypes.needsField'));
      return;
    }
    if (statuses.filter((s) => s.name.trim()).length === 0) {
      notify.toast.error(t('ticketTypes.needsStatus'));
      return;
    }

    setSubmitting(true);
    const payload = {
      name,
      description: description || undefined,
      is_root: isRoot,
      child_type_codes: childCodes,
      default_role_id: roleId || undefined,
      blocks_parent_close: blocks,
      relation_kinds: type?.relation_kinds ?? ['aircraft'],
      fields,
      statuses,
      steps,
    };
    const res = type ? await updateTicketType(type.id, payload) : await createTicketType(payload);
    setSubmitting(false);
    if (res.ok) {
      notify.toast.success(t(type ? 'ticketTypes.updatedOk' : 'ticketTypes.createdOk'));
      onSuccess();
      onClose();
      return;
    }
    notify.fromApiError(res);
  };

  const tabButton = (value: Tab, label: string, count?: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setTab(value)}
      className={cn(
        'shrink-0 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted',
        tab === value && 'border-primary bg-primary/10 text-primary',
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 text-xs opacity-70">{count}</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabButton('data', t('ticketTypes.tabData'))}
        {tabButton('fields', t('ticketTypes.tabFields'), fields.length)}
        {tabButton('statuses', t('ticketTypes.tabStatuses'), statuses.length)}
        {tabButton('steps', t('ticketTypes.tabSteps'), steps.length)}
      </div>

      {tab === 'data' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">{t('ticketTypes.fields.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">{t('ticketTypes.fields.description')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">{t('ticketTypes.fields.role')}</Label>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">{t('common.optional')}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={isRoot}
              onChange={(e) => setIsRoot(e.target.checked)}
            />
            {t('ticketTypes.isRoot')}
          </label>

          {isRoot && (
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">{t('ticketTypes.childTypes')}</Label>
              <div className="flex flex-wrap gap-2">
                {allTypes
                  .filter((x) => !x.is_root && x.code !== type?.code)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() =>
                        setChildCodes((prev) =>
                          prev.includes(x.code)
                            ? prev.filter((c) => c !== x.code)
                            : [...prev, x.code],
                        )
                      }
                      className={cn(
                        'rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted',
                        childCodes.includes(x.code) && 'border-primary bg-primary/10 text-primary',
                      )}
                    >
                      {x.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {!isRoot && (
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={blocks}
                onChange={(e) => setBlocks(e.target.checked)}
              />
              {t('ticketTypes.blocksClose')}
            </label>
          )}
        </div>
      )}

      {tab === 'fields' && (
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setFields((prev) => [
                ...prev,
                {
                  id: uid('f', prev.length + 1),
                  key: '',
                  label: '',
                  type: 'text',
                  required: false,
                  width: 'full',
                  sort_order: prev.length + 1,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            {t('ticketTypes.addField')}
          </Button>
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                permissions={permissions}
                onChange={(next) =>
                  setFields((prev) =>
                    prev.map((f, i) => {
                      if (i === index) return next;
                      // Un rol identifica un solo campo: asignarlo aquí lo quita del anterior.
                      return next.role && f.role === next.role ? { ...f, role: undefined } : f;
                    }),
                  )
                }
                onRemove={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                onMove={(direction) => setFields((prev) => move(prev, index, direction))}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'statuses' && (
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setStatuses((prev) => [
                ...prev,
                {
                  id: uid('s', prev.length + 1),
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
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {statuses.map((status, index) => (
              <StatusEditor
                key={status.id}
                status={status}
                index={index}
                total={statuses.length}
                onChange={(next) =>
                  setStatuses((prev) => prev.map((s, i) => (i === index ? next : s)))
                }
                onRemove={() => setStatuses((prev) => prev.filter((_, i) => i !== index))}
                onMove={(direction) => setStatuses((prev) => move(prev, index, direction))}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'steps' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('ticketTypes.stepsHint')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                {
                  id: uid('st', prev.length + 1),
                  code: '',
                  name: '',
                  required: true,
                  sort_order: prev.length + 1,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            {t('ticketTypes.addStep')}
          </Button>
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {steps.map((step, index) => (
              <StepEditor
                key={step.id}
                step={step}
                index={index}
                total={steps.length}
                roles={roles}
                onChange={(next) => setSteps((prev) => prev.map((s, i) => (i === index ? next : s)))}
                onRemove={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                onMove={(direction) => setSteps((prev) => move(prev, index, direction))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" className="flex-1" disabled={isSubmitting} onClick={() => void onSubmit()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
