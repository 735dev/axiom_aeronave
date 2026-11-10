import { describe, expect, it } from 'vitest';
import { FieldDef } from '../types/ticket.types';
import {
  CatalogOption,
  filterDependentOptions,
  isValidOption,
  resolveAircraftAutofill,
} from './aircraftAutofill';

const field = (key: string, role?: FieldDef['role']): FieldDef => ({
  id: key,
  key,
  label: key,
  type: 'select',
  required: false,
  width: 'half',
  role,
  sort_order: 1,
});

const FIELDS = [field('matricula', 'aircraft'), field('marca', 'aircraft_brand'), field('modelo', 'aircraft_model')];
const MODELS: CatalogOption[] = [
  { value: 'king_air_200', label: 'King Air 200', extra: 'beechcraft' },
  { value: 'cheyenne', label: 'Cheyenne', extra: 'piper' },
];
const AIRCRAFTS: CatalogOption[] = [
  { value: 'YV2323', label: 'King Air 200', extra: 'king_air_200' },
  { value: 'YV2528', label: 'Cheyenne', extra: 'cheyenne' },
  { value: 'YV0000', label: 'Sin modelo' },
];

describe('filterDependentOptions', () => {
  it('deja solo las opciones que cuelgan del padre', () => {
    expect(filterDependentOptions(MODELS, 'piper').map((o) => o.value)).toEqual(['cheyenne']);
  });

  it('sin padre elegido muestra todas', () => {
    expect(filterDependentOptions(MODELS, '')).toHaveLength(2);
    expect(filterDependentOptions(MODELS, undefined)).toHaveLength(2);
  });

  it('un padre sin hijos deja la lista vacía', () => {
    expect(filterDependentOptions(MODELS, 'cessna')).toEqual([]);
  });
});

describe('isValidOption', () => {
  it('reconoce solo valores que están en la lista', () => {
    expect(isValidOption(MODELS, 'cheyenne')).toBe(true);
    expect(isValidOption(MODELS, 'otro')).toBe(false);
    expect(isValidOption(MODELS, undefined)).toBe(false);
  });
});

describe('resolveAircraftAutofill', () => {
  const run = (aircraftValue: unknown, fields = FIELDS) =>
    resolveAircraftAutofill({ fields, aircraftValue, aircrafts: AIRCRAFTS, models: MODELS });

  it('propone modelo y marca de la matrícula, por rol y no por clave', () => {
    expect(run('YV2528')).toEqual({ modelo: 'cheyenne', marca: 'piper' });
  });

  it('no propone nada si la matrícula es desconocida o vacía', () => {
    expect(run('XX')).toBeNull();
    expect(run('')).toBeNull();
  });

  it('no propone nada si la aeronave no tiene modelo ligado', () => {
    expect(run('YV0000')).toBeNull();
  });

  it('no propone nada si el tipo no tiene campos de marca ni modelo', () => {
    expect(run('YV2323', [field('matricula', 'aircraft')])).toBeNull();
  });

  it('llena solo el campo que existe', () => {
    expect(run('YV2323', [field('matricula', 'aircraft'), field('modelo', 'aircraft_model')])).toEqual({
      modelo: 'king_air_200',
    });
  });
});
