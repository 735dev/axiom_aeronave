import { describe, expect, it } from 'vitest';
import { USERS, findTicket, loginAs, newExpense } from '@/test/mockApi';

describe('códigos de ticket', () => {
  it('50 altas seguidas no repiten código', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const codes = Array.from({ length: 50 }, () => newExpense(s, op.id).data.code);
    expect(new Set(codes).size).toBe(50);
  });

  it('un código nuevo no choca con ninguno existente', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const existing = new Set((s.get('/tickets/', { limit: '500' }).data.data as any[]).map((t) => t.code));
    const created = newExpense(s, op.id).data.code;
    expect(existing.has(created)).toBe(false);
  });
});
