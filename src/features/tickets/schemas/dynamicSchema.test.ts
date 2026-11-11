import { describe, expect, it } from 'vitest';
import { buildDynamicSchema } from './dynamicSchema';
import { FieldDef } from '../types/ticket.types';

const def = (key: string, type: FieldDef['type'], required = false): FieldDef =>
  ({ id: key, key, label: key, type, required, width: 'half', sort_order: 1 }) as FieldDef;

const check = (field: FieldDef, value: unknown) =>
  buildDynamicSchema([field]).safeParse({ [field.key]: value });

describe('campos numéricos', () => {
  const passengers = def('passengers', 'integer');

  it('pasajeros no admite negativos', () => {
    for (const value of [-1, -20, -0.5]) expect(check(passengers, value).success).toBe(false);
  });

  it('pasajeros no admite fracciones', () => {
    expect(check(passengers, 2.5).success).toBe(false);
  });

  it('pasajeros admite cero y enteros positivos', () => {
    for (const value of [0, 1, 21]) expect(check(passengers, value).success).toBe(true);
  });

  it('un campo opcional vacío sigue siendo válido', () => {
    for (const value of ['', undefined, Number.NaN]) {
      expect(check(passengers, value).success).toBe(true);
    }
  });

  it('un número común tampoco admite negativos, pero sí decimales', () => {
    const rate = def('exchange_rate', 'number');
    expect(check(rate, -5).success).toBe(false);
    expect(check(rate, 899.27).success).toBe(true);
  });

  it('un monto tampoco admite negativos', () => {
    expect(check(def('amount', 'money'), -1).success).toBe(false);
  });

  it('el mensaje de error es una clave traducible', () => {
    const result = check(passengers, -3);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('errors.nonNegative');
  });

  it('obligatorio sigue exigiendo mayor que cero', () => {
    expect(check(def('n', 'integer', true), 0).success).toBe(false);
    expect(check(def('n', 'integer', true), 3).success).toBe(true);
  });
});
