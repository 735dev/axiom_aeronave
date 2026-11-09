import { FieldDef, StatusDef, StepDef } from '@/features/tickets/types/ticket.types';

interface RoleLike {
  id: string;
  name: string;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((item, index) => {
      const f = item as Partial<FieldDef>;
      const label = String(f.label ?? '').trim();
      if (!label) return null;
      return {
        id: f.id ?? `f-${Date.now()}-${index}`,
        key: f.key || slug(label) || `campo_${index + 1}`,
        label,
        type: (f.type ?? 'text') as FieldDef['type'],
        required: Boolean(f.required),
        width: (f.width ?? 'full') as FieldDef['width'],
        help: f.help || undefined,
        options: Array.isArray(f.options) ? f.options : undefined,
        catalog: f.catalog,
        read_only: Boolean(f.read_only),
        // Sin esto, guardar el tipo borraba qué campo es el monto y quién lo ve.
        role: f.role || undefined,
        view_permission: f.view_permission || undefined,
        edit_permission: f.edit_permission || undefined,
        sort_order: index + 1,
      } as FieldDef;
    })
    .filter((f): f is FieldDef => f !== null);
}

export function normalizeStatuses(raw: unknown): StatusDef[] {
  if (!Array.isArray(raw)) return [];
  const list = raw
    .map((item, index) => {
      const s = item as Partial<StatusDef>;
      const name = String(s.name ?? '').trim();
      if (!name) return null;
      return {
        id: s.id ?? `s-${Date.now()}-${index}`,
        code: s.code || slug(name),
        name,
        color: (s.color ?? 'default') as StatusDef['color'],
        sort_order: index + 1,
        is_initial: Boolean(s.is_initial),
        is_final: Boolean(s.is_final),
        // Por omisión un estado cuenta; solo rechazo/anulación lo desactivan.
        counts_as_committed: s.counts_as_committed ?? true,
      } as StatusDef;
    })
    .filter((s): s is StatusDef => s !== null);

  // Siempre debe existir un estado inicial: si nadie lo marcó, es el primero.
  if (list.length > 0 && !list.some((s) => s.is_initial)) list[0]!.is_initial = true;
  return list;
}

export function normalizeSteps(raw: unknown, roles: RoleLike[]): StepDef[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((item, index) => {
      const s = item as Partial<StepDef>;
      const name = String(s.name ?? '').trim();
      if (!name) return null;
      const role = roles.find((r) => r.id === s.role_id);
      return {
        id: s.id ?? `st-${Date.now()}-${index}`,
        code: s.code || slug(name),
        name,
        role_id: role?.id,
        role_name: role?.name,
        responsible_area: s.responsible_area || undefined,
        required: s.required ?? true,
        sort_order: index + 1,
      } as StepDef;
    })
    .filter((s): s is StepDef => s !== null);
}
