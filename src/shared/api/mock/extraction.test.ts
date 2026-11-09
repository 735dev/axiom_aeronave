import { describe, expect, it } from 'vitest';
import { USERS, loginAs } from '@/test/mockApi';

const read = (s: ReturnType<typeof loginAs>, type: string, name: string, size = 100, mime = 'image/jpeg') =>
  s.post('/attachments/extract/', { type_code: type, name, mime, size });

describe('lectura previa del comprobante', () => {
  const s = loginAs(USERS.superuser);

  it('propone monto, moneda, concepto, fecha y proveedor, cada uno con confianza', () => {
    // Se busca un nombre legible: 1 de cada 7 sale ilegible a propósito.
    const names = Array.from({ length: 30 }, (_, i) => `ticket-${i}.jpg`);
    const ok = names.map((n) => read(s, 'expense', n)).find((r) => r.data.status === 'extracted')!;
    const keys = ok.data.fields.map((f: any) => f.key).sort();
    expect(keys).toEqual(['amount', 'concept', 'currency', 'expense_date', 'supplier'].sort());
    ok.data.fields.forEach((f: any) => expect(['high', 'low']).toContain(f.confidence));
  });

  it('es repetible: el mismo comprobante da la misma lectura', () => {
    expect(read(s, 'expense', 'a.jpg', 5).data).toEqual(read(s, 'expense', 'a.jpg', 5).data);
  });

  it('algunos salen ilegibles y no traen campos (carga manual)', () => {
    const res = Array.from({ length: 40 }, (_, i) => read(s, 'expense', `x-${i}.jpg`).data);
    const bad = res.filter((r) => r.status === 'unreadable');
    expect(bad.length).toBeGreaterThan(0);
    bad.forEach((r) => expect(r.fields).toEqual([]));
  });

  it('no guarda nada: no crea tickets ni archiva en Blackbox', () => {
    const before = (s.get('/tickets/', { limit: '500' }).data.data as any[]).length;
    read(s, 'expense', 'sin-guardar.jpg');
    expect((s.get('/tickets/', { limit: '500' }).data.data as any[]).length).toBe(before);
  });

  it('un tipo sin importe no lee comprobantes', () => {
    expect(read(s, 'hangar_incident', 'a.jpg').status).toBe(422);
  });

  it('un PDF no se lee (solo imágenes)', () => {
    expect(read(s, 'expense', 'a.pdf', 100, 'application/pdf').status).toBe(422);
  });

  it('tipo inexistente es 422', () => {
    expect(read(s, 'no_existe', 'a.jpg').status).toBe(422);
  });

  it('el rol supplier lo marca el tipo, no el nombre del campo', () => {
    const type = (s.get('/ticket-types/').data as any[]).find((t) => t.code === 'expense');
    expect(type.fields.find((f: any) => f.role === 'supplier')?.key).toBe('supplier');
  });
});
