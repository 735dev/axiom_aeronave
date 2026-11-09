import { describe, expect, it } from 'vitest';
import { PNG, USERS, findTicket, loginAs, newExpense } from '@/test/mockApi';

type S = ReturnType<typeof loginAs>;

/** Crea gastos con soporte hasta que la lectura trae algún dato de baja confianza. */
function lowConfidenceFile(s: S) {
  const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
  for (let i = 0; i < 80; i += 1) {
    const exp = newExpense(s, op.id).data;
    const t = s.post(`/tickets/${exp.id}/attachments/`, { name: `g-${i}.png`, mime: 'image/png', size: 9, data_url: PNG }).data;
    const file = t.files.at(-1);
    if (file.extraction?.status === 'extracted' && file.extraction.fields.some((f: any) => f.confidence === 'low')) {
      return { exp, file, low: file.extraction.fields.filter((f: any) => f.confidence === 'low') };
    }
  }
  throw new Error('sin lectura de baja confianza');
}
const all = (file: any) => file.extraction.fields.map((f: any) => ({ key: f.key, value: f.value }));

describe('consola de validación: baja confianza obligatoria', () => {
  it('aprobar a ciegas un dato dudoso se rechaza y nombra el campo', () => {
    const s = loginAs(USERS.admin);
    const { exp, file, low } = lowConfidenceFile(s);
    const r = s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, { fields: all(file) });
    expect(r.status).toBe(422);
    expect(r.data.detail).toContain(low[0].label);
  });

  it('marcarlo como revisado permite aprobar', () => {
    const s = loginAs(USERS.admin);
    const { exp, file, low } = lowConfidenceFile(s);
    const r = s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, {
      fields: all(file),
      confirmed: low.map((f: any) => f.key),
    });
    expect(r.status).toBe(200);
  });

  it('corregir el dato cuenta como revisarlo', () => {
    const s = loginAs(USERS.admin);
    const { exp, file, low } = lowConfidenceFile(s);
    const fields = all(file).map((f: any) => (f.key === low[0].key ? { ...f, value: String(f.value) + '1' } : f));
    const others = low.slice(1).map((f: any) => f.key);
    expect(s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, { fields, confirmed: others }).status).toBe(200);
  });

  it('confirmar solo uno de varios dudosos no basta', () => {
    const s = loginAs(USERS.admin);
    let checked = false;
    for (let i = 0; i < 60 && !checked; i += 1) {
      const { exp, file, low } = lowConfidenceFile(s);
      if (low.length < 2) continue;
      const r = s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, { fields: all(file), confirmed: [low[0].key] });
      expect(r.status).toBe(422);
      checked = true;
    }
    expect(checked).toBe(true);
  });

  it('el rechazo no deja la lectura validada ni cambia el ticket', () => {
    const s = loginAs(USERS.admin);
    const { exp, file } = lowConfidenceFile(s);
    s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, { fields: all(file) });
    const after = s.get(`/tickets/${exp.id}/`).data.files.find((f: any) => f.id === file.id);
    expect(after.extraction.status).toBe('extracted');
  });

  it('la aprobación válida queda en la cola como validada y sale de pendientes', () => {
    const s = loginAs(USERS.admin);
    const { exp, file, low } = lowConfidenceFile(s);
    s.post(`/tickets/${exp.id}/attachments/${file.id}/validate/`, { fields: all(file), confirmed: low.map((f: any) => f.key) });
    const pending = s.get('/attachments/pending/', { limit: '500' }).data.data as any[];
    expect(pending.some((p) => p.file.id === file.id)).toBe(false);
  });
});
