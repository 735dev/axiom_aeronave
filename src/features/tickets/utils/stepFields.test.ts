import { describe, expect, it } from 'vitest';
import { FieldDef, StepDef } from '../types/ticket.types';
import {
  blockedByEarlierRoleStep,
  formatStepValue,
  groupStepFields,
  statusRoleIds,
  stepOwnedKeys,
} from './stepFields';

function field(key: string, extra: Partial<FieldDef> = {}): FieldDef {
  return {
    id: key,
    key,
    label: key,
    type: 'text',
    required: false,
    width: 'full',
    sort_order: 1,
    ...extra,
  };
}

const steps = [
  { code: 'report', role_id: 'pilot' },
  { code: 'diagnosis', role_id: 'maintenance' },
] as Pick<StepDef, 'code' | 'role_id'>[];

describe('groupStepFields', () => {
  it('agrupa cada campo por el paso que el tipo le asigna', () => {
    const fields = [
      field('description', { type: 'textarea', step_code: 'report', sort_order: 2 }),
      field('corrective_action', { type: 'textarea', step_code: 'diagnosis', sort_order: 1 }),
      field('amount', { type: 'money' }),
    ];
    const grouped = groupStepFields(fields, steps);

    expect(grouped.get('report')?.map((item) => item.key)).toEqual(['description']);
    expect(grouped.get('diagnosis')?.map((item) => item.key)).toEqual(['corrective_action']);
    expect(stepOwnedKeys(fields, steps).has('amount')).toBe(false);
  });

  it('ignora un paso que el tipo no tiene y deja vacío el formulario general', () => {
    const fields = [
      field('description', { step_code: 'missing' }),
      field('notes', { step_code: '  ' }),
    ];
    expect(groupStepFields(fields, steps).size).toBe(0);
    expect(stepOwnedKeys(fields, steps).size).toBe(0);
  });
});

describe('statusRoleIds', () => {
  it('devuelve el rol del paso que tiene un campo con permiso de edición', () => {
    const fields = [
      field('description', { step_code: 'report' }),
      field('corrective_action', { step_code: 'diagnosis', edit_permission: 'tickets.edit.technical_report' }),
    ];
    expect(statusRoleIds(fields, steps)).toEqual(new Set(['maintenance']));
  });

  it('no restringe el estado si ningún campo de paso pide permiso', () => {
    const fields = [field('description', { step_code: 'report' })];
    expect(statusRoleIds(fields, steps)).toBeNull();
    expect(statusRoleIds([field('amount')], steps)).toBeNull();
  });
});

describe('blockedByEarlierRoleStep', () => {
  const flow = [
    { code: 'report', role_id: 'pilot', sort_order: 1 },
    { code: 'diagnosis', role_id: 'maintenance', sort_order: 2 },
    { code: 'verification', role_id: 'maintenance', sort_order: 6 },
  ];
  const anyone = () => true;

  it('deja abrir el primer paso de otro rol aunque el anterior siga pendiente', () => {
    const diagnosis = flow[1];
    expect(blockedByEarlierRoleStep(diagnosis, flow, new Set(), anyone)).toBe(false);
  });

  it('espera al paso anterior del mismo rol', () => {
    const verification = flow[2];
    expect(blockedByEarlierRoleStep(verification, flow, new Set(), anyone)).toBe(true);
    expect(blockedByEarlierRoleStep(verification, flow, new Set(['diagnosis']), anyone)).toBe(false);
  });

  it('no cuenta un paso anterior que esta persona no puede registrar', () => {
    const verification = flow[2];
    const onlyPilot = (step: (typeof flow)[number]) => step.role_id === 'pilot';
    expect(blockedByEarlierRoleStep(verification, flow, new Set(), onlyPilot)).toBe(false);
  });
});

describe('formatStepValue', () => {
  it('omite el checkbox sin marcar y traduce la opción de una lista', () => {
    expect(formatStepValue(field('flag', { type: 'checkbox' }), false)).toBeNull();
    expect(formatStepValue(field('flag', { type: 'checkbox' }), true)).toBe('yes');
    expect(
      formatStepValue(
        field('system', {
          type: 'select',
          options: [{ value: 'engine', label: 'Motor' }],
        }),
        'engine',
      ),
    ).toBe('Motor');
  });
});
