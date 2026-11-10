import { describe, expect, it } from 'vitest';
import { applyList, clampPage } from './useClientList';

interface Row {
  name: string;
  active: boolean;
}

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Item ${i + 1}`, active: i % 2 === 0 }));

const text = (r: Row) => r.name;
const filters = { active: (r: Row, v: string) => String(r.active) === v };

describe('applyList', () => {
  it('busca sin distinguir tildes ni mayúsculas', () => {
    const items = [
      { name: 'Aviación civil', active: true },
      { name: 'Mantenimiento', active: true },
    ];
    expect(applyList(items, 'AVIACION', {}, text).map((r) => r.name)).toEqual(['Aviación civil']);
    expect(applyList(items, 'mantenimiénto', {}, text).map((r) => r.name)).toEqual(['Mantenimiento']);
  });

  it('una búsqueda vacía o de espacios no filtra', () => {
    expect(applyList(rows(4), '   ', {}, text)).toHaveLength(4);
  });

  it('aplica filtros por valor', () => {
    expect(applyList(rows(6), '', { active: 'true' }, text, filters)).toHaveLength(3);
    expect(applyList(rows(6), '', { active: 'false' }, text, filters)).toHaveLength(3);
  });

  it('un filtro vacío o desconocido no filtra', () => {
    expect(applyList(rows(4), '', { active: '' }, text, filters)).toHaveLength(4);
    expect(applyList(rows(4), '', { otro: 'x' }, text, filters)).toHaveLength(4);
  });

  it('combina búsqueda y filtros', () => {
    const out = applyList(rows(6), 'item 3', { active: 'true' }, text, filters);
    expect(out.map((r) => r.name)).toEqual(['Item 3']);
    expect(applyList(rows(6), 'item 2', { active: 'true' }, text, filters)).toHaveLength(0);
  });
});

describe('clampPage', () => {
  it('deja pasar una página válida', () => {
    expect(clampPage(2, 25, 10)).toBe(2);
  });

  it('retrocede si la lista se encogió', () => {
    expect(clampPage(3, 12, 10)).toBe(2);
    expect(clampPage(5, 0, 10)).toBe(1);
  });

  it('no baja de la página 1', () => {
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(-4, 25, 10)).toBe(1);
  });
});
