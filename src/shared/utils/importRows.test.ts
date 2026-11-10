import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_ROWS, describeRowError, prepareImport, templateCsv } from './importRows';
import { parseCsvObjects } from './csv';

const COLUMNS = ['code', 'name', 'extra'];
const REQUIRED = ['code', 'name'];

describe('prepareImport', () => {
  it('deja solo las columnas de la plantilla, en orden, y avisa de las ignoradas', () => {
    const parsed = parseCsvObjects('name,code,color\nAvión,YV1,rojo\n');
    const out = prepareImport(parsed, COLUMNS, REQUIRED);
    expect(out.problem).toBeUndefined();
    expect(out.rows).toEqual([{ code: 'YV1', name: 'Avión', extra: '' }]);
    expect(out.ignored).toEqual(['color']);
  });

  it('rechaza un archivo sin filas de datos', () => {
    expect(prepareImport(parseCsvObjects('code,name\n'), COLUMNS, REQUIRED).problem).toEqual({ code: 'empty' });
  });

  it('nombra las columnas obligatorias que faltan', () => {
    const out = prepareImport(parseCsvObjects('code,extra\nA,x\n'), COLUMNS, REQUIRED);
    expect(out.problem).toEqual({ code: 'missingColumns', columns: ['name'] });
    expect(out.rows).toEqual([]);
  });

  it('rechaza más filas que el máximo sin armar el lote', () => {
    const csv = ['code,name', ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `C${i},N${i}`)].join('\n');
    const out = prepareImport(parseCsvObjects(csv), COLUMNS, REQUIRED);
    expect(out.problem).toEqual({ code: 'tooMany', max: IMPORT_MAX_ROWS, total: IMPORT_MAX_ROWS + 1 });
    expect(out.rows).toEqual([]);
  });

  it('acepta cabeceras en mayúsculas, BOM y punto y coma', () => {
    const out = prepareImport(parseCsvObjects('﻿Code;Name\r\nA;Uno\r\n'), COLUMNS, REQUIRED);
    expect(out.rows).toEqual([{ code: 'A', name: 'Uno', extra: '' }]);
  });
});

describe('templateCsv', () => {
  it('es solo la fila de cabeceras', () => {
    expect(templateCsv(COLUMNS)).toBe('code,name,extra');
  });
});

describe('describeRowError', () => {
  it('une fila, campo y mensaje', () => {
    expect(describeRowError({ row: 3, field: 'email', message: 'duplicado' })).toBe('3 · email: duplicado');
    expect(describeRowError({ row: 2, field: '', message: 'vacía' })).toBe('2: vacía');
  });
});
