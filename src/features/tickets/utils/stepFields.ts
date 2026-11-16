import { FieldDef, StepDef } from '../types/ticket.types';

/**
 * Agrupa los campos por el paso que el tipo les asigna. Un campo sin paso,
 * o con un paso que el tipo ya no tiene, sigue en el formulario general.
 */
export function groupStepFields(fields: FieldDef[], steps: Pick<StepDef, 'code'>[]): Map<string, FieldDef[]> {
  const codes = new Set(steps.map((step) => step.code));
  const grouped = new Map<string, FieldDef[]>();

  for (const field of [...fields].sort((a, b) => a.sort_order - b.sort_order)) {
    const code = field.step_code?.trim();
    if (!code || !codes.has(code)) continue;
    const own = grouped.get(code) ?? [];
    own.push(field);
    grouped.set(code, own);
  }

  return grouped;
}

/**
 * Un paso posterior del mismo rol espera a que se registre el anterior de ese rol.
 * El paso de otro rol no cuenta: quien puede actuar por todos abre el primero
 * pendiente de cada rol sin esperar a los demás.
 */
export function blockedByEarlierRoleStep(
  step: Pick<StepDef, 'code' | 'role_id' | 'sort_order'>,
  steps: Pick<StepDef, 'code' | 'role_id' | 'sort_order'>[],
  decided: ReadonlySet<string>,
  canAct: (candidate: Pick<StepDef, 'code' | 'role_id' | 'sort_order'>) => boolean,
): boolean {
  const roleId = step.role_id ?? null;
  return steps.some(
    (earlier) =>
      earlier.code !== step.code &&
      (earlier.role_id ?? null) === roleId &&
      earlier.sort_order < step.sort_order &&
      canAct(earlier) &&
      !decided.has(earlier.code),
  );
}

export function stepOwnedKeys(fields: FieldDef[], steps: Pick<StepDef, 'code'>[]): Set<string> {
  const keys = new Set<string>();
  for (const own of groupStepFields(fields, steps).values()) {
    for (const field of own) keys.add(field.key);
  }
  return keys;
}

/**
 * Roles que pueden cambiar el estado cuando el tipo reparte campos en pasos.
 * Null: no hay reparto, o ningún campo de paso restringe la edición, así que
 * quien puede editar el ticket también mueve el estado.
 */
export function statusRoleIds(
  fields: FieldDef[],
  steps: Pick<StepDef, 'code' | 'role_id'>[],
): Set<string> | null {
  const grouped = groupStepFields(fields, steps);
  if (grouped.size === 0) return null;
  const roles = new Set<string>();
  for (const [code, own] of grouped) {
    if (!own.some((field) => field.edit_permission)) continue;
    const roleId = steps.find((step) => step.code === code)?.role_id;
    if (roleId) roles.add(roleId);
  }
  return roles.size > 0 ? roles : null;
}

/** Texto ya guardado. Un checkbox sin marcar no aporta nada que mostrar. */
export function formatStepValue(field: FieldDef, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (field.type === 'checkbox') return value === true ? 'yes' : null;
  if (field.type === 'checkbox_group' && Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(', ') : null;
  }
  if (field.type === 'select') {
    const match = field.options?.find((option) => option.value === String(value));
    return match?.label ?? String(value);
  }
  return String(value);
}
