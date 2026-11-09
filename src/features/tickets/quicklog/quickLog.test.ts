import { describe, expect, it } from 'vitest';
import { PNG, USERS, findTicket, loginAs } from '@/test/mockApi';
import { OfflineQueue } from '@/shared/offline/queue';
import { createMemoryStore } from '@/shared/offline/idbStore';
import {
  EMPTY_FORM,
  MAX_NOTE,
  NO_FINDING_TEXT,
  QuickLogForm,
  appendFinding,
  buildQuickLogInput,
  findOpenReport,
  nowAsTime,
  quickLogPayload,
  pickDefaultOperation,
  submitQuickLog,
  validateQuickLog,
} from './quickLog';
import { addedFile, manifestFiles } from '../passengers/passport';

const ok: QuickLogForm = {
  ...EMPTY_FORM,
  operationId: 'op-1',
  departure: '08:00',
  arrival: '09:30',
};
const TYPE = { name: 'Reporte técnico', default_role_id: 'r-4' };

describe('validación de la bitácora', () => {
  it('un formulario completo sin novedad es válido', () => {
    expect(validateQuickLog(ok)).toEqual({});
  });
  it('exige operación, salida y llegada', () => {
    expect(validateQuickLog(EMPTY_FORM)).toEqual({
      operation: 'quicklog.errors.operation',
      departure: 'quicklog.errors.departureRequired',
      arrival: 'quicklog.errors.arrivalRequired',
    });
  });
  it('rechaza una hora mal formada', () => {
    expect(validateQuickLog({ ...ok, departure: '25:00' }).departure).toBe(
      'quicklog.errors.timeInvalid',
    );
    expect(validateQuickLog({ ...ok, arrival: '9:5' }).arrival).toBe('quicklog.errors.timeInvalid');
  });
  it('llegada anterior a la salida es error con mensaje claro', () => {
    expect(validateQuickLog({ ...ok, departure: '22:00', arrival: '01:10' }).arrival).toBe(
      'quicklog.errors.arrivalBeforeDeparture',
    );
  });
  it('llegada anterior a la salida es válida si cruzó la medianoche', () => {
    expect(
      validateQuickLog({ ...ok, departure: '22:00', arrival: '01:10', nextDay: true }),
    ).toEqual({});
  });
  it('salida y llegada iguales se rechazan', () => {
    expect(validateQuickLog({ ...ok, arrival: '08:00' }).arrival).toBe('quicklog.errors.sameTime');
  });
  it('con novedad la nota es obligatoria y no puede ser solo espacios', () => {
    expect(validateQuickLog({ ...ok, hasFinding: true }).note).toBe('quicklog.errors.noteRequired');
    expect(validateQuickLog({ ...ok, hasFinding: true, note: '   ' }).note).toBe(
      'quicklog.errors.noteRequired',
    );
    expect(validateQuickLog({ ...ok, hasFinding: true, note: 'Ruido en el motor' })).toEqual({});
  });
  it('la nota admite 280 caracteres y rechaza 281', () => {
    expect(validateQuickLog({ ...ok, hasFinding: true, note: 'a'.repeat(MAX_NOTE) })).toEqual({});
    expect(validateQuickLog({ ...ok, hasFinding: true, note: 'a'.repeat(MAX_NOTE + 1) }).note).toBe(
      'quicklog.errors.noteTooLong',
    );
  });
});

describe('opciones rápidas y valores por defecto', () => {
  it('un hallazgo se agrega a la nota separado por punto', () => {
    expect(appendFinding('', 'Motor')).toBe('Motor');
    expect(appendFinding('Motor', 'Neumáticos')).toBe('Motor. Neumáticos');
  });
  it('tocar dos veces el mismo hallazgo no lo duplica', () => {
    expect(appendFinding('Motor', 'motor')).toBe('Motor');
  });
  it('si el hallazgo no cabe en 280 caracteres no se agrega (null)', () => {
    expect(appendFinding('a'.repeat(275), 'Hidráulico')).toBeNull();
  });
  it('"Ahora" da la hora local en HH:MM con cero a la izquierda', () => {
    expect(nowAsTime(new Date(2026, 8, 1, 7, 5))).toBe('07:05');
  });
  it('la operación por defecto es la abierta de la aeronave del usuario', () => {
    const op = (id: string, tail: string, final = false) =>
      ({
        id,
        status_is_final: final,
        relations: [{ kind: 'aircraft', code: tail }],
      }) as never;
    const list = [op('a', 'YV1111'), op('b', 'YV2323'), op('c', 'YV2323', true)];
    expect(pickDefaultOperation(list, 'YV2323')?.id).toBe('b');
    expect(pickDefaultOperation(list, 'YV9999')?.id).toBe('a');
    expect(pickDefaultOperation(list)?.id).toBe('a');
    expect(pickDefaultOperation([op('c', 'YV2323', true)], 'YV2323')).toBeUndefined();
  });
});

describe('payload de la bitácora', () => {
  it('sin novedad deja descripción explícita y las llaves acordadas', () => {
    const input = buildQuickLogInput(ok, TYPE, { id: 'op-1', code: 'YV2323-001-26' });
    expect(input).toEqual({
      type_code: 'technical_report',
      title: 'Reporte técnico · YV2323-001-26',
      parent_id: 'op-1',
      assigned_role_id: 'r-4',
      payload: {
        actual_departure: '08:00',
        actual_arrival: '09:30',
        has_finding: false,
        description: NO_FINDING_TEXT,
      },
    });
  });
  it('con novedad la descripción es la nota recortada', () => {
    const input = buildQuickLogInput(
      { ...ok, hasFinding: true, note: '  Ruido en el motor  ' },
      TYPE,
      { id: 'op-1', code: 'X' },
    );
    expect(input.payload).toMatchObject({ has_finding: true, description: 'Ruido en el motor' });
  });
  it('una nota escrita sin marcar novedad NO viaja', () => {
    const input = buildQuickLogInput({ ...ok, note: 'olvidada' }, TYPE, { id: 'o', code: 'X' });
    expect(input.payload.description).toBe(NO_FINDING_TEXT);
  });
  it('la llegada al día siguiente queda registrada solo cuando aplica', () => {
    const night = buildQuickLogInput({ ...ok, nextDay: true }, TYPE, { id: 'o', code: 'X' });
    expect(night.payload.arrival_next_day).toBe(true);
    expect(buildQuickLogInput(ok, TYPE, { id: 'o', code: 'X' }).payload).not.toHaveProperty(
      'arrival_next_day',
    );
  });
});

describe('la bitácora crea el reporte técnico en el expediente (mock)', () => {
  it('crea un technical_report hijo de la operación con el payload y la foto', () => {
    const s = loginAs(USERS.pilot);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const type = s.get('/ticket-types/').data.find((x: any) => x.code === 'technical_report');
    const input = buildQuickLogInput(
      { ...ok, operationId: op.id, hasFinding: true, note: 'Ruido en el motor' },
      type,
      op,
    );
    const created = s.post('/tickets/', input, 'ql-1');
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      type_code: 'technical_report',
      parent_id: op.id,
      parent_code: op.code,
      payload: {
        actual_departure: '08:00',
        actual_arrival: '09:30',
        has_finding: true,
        description: 'Ruido en el motor',
      },
    });
    const withPhoto = s.post(
      `/tickets/${created.data.id}/attachments/`,
      { name: 'ala.png', mime: 'image/png', size: 8, data_url: PNG, field_key: 'photo' },
      'ql-1:a0',
    );
    expect(withPhoto.data.files).toHaveLength(1);
    expect(s.get(`/tickets/${op.id}/`).data.children_count).toBeGreaterThan(0);
  });

  it('reenviar la misma bitácora con la misma clave no crea un segundo reporte', () => {
    const s = loginAs(USERS.pilot);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const input = buildQuickLogInput(ok, TYPE, op);
    const count = () => s.get('/tickets/', { parent_id: op.id, limit: '200' }).data.total as number;
    const before = count();
    const a = s.post('/tickets/', input, 'ql-dup');
    const b = s.post('/tickets/', input, 'ql-dup');
    expect(b.data.id).toBe(a.data.id);
    expect(count()).toBe(before + 1);
  });

  it('en una operación cerrada el servidor lo rechaza con 409', () => {
    const s = loginAs(USERS.pilot);
    const closed = findTicket(s, (t) => t.type_code === 'operation' && t.status_is_final);
    expect(s.post('/tickets/', buildQuickLogInput(ok, TYPE, closed), 'ql-closed').status).toBe(409);
  });
});

describe('completar el reporte abierto de la operación', () => {
  const rep = (id: string, type: string, final: boolean, at: string) =>
    ({ id, type_code: type, status_is_final: final, created_at: at }) as never;

  it('elige el reporte técnico abierto más antiguo e ignora cerrados y otros tipos', () => {
    const list = [
      rep('gasto', 'expense', false, '2026-01-01'),
      rep('cerrado', 'technical_report', true, '2026-01-02'),
      rep('nuevo', 'technical_report', false, '2026-03-01'),
      rep('origen', 'technical_report', false, '2026-02-01'),
    ];
    expect(findOpenReport(list)?.id).toBe('origen');
    expect(findOpenReport([rep('c', 'technical_report', true, '1')])).toBeUndefined();
    expect(findOpenReport([])).toBeUndefined();
  });

  it('el payload del PATCH es el mismo que el de la creación', () => {
    const form = { ...ok, hasFinding: true, note: ' Fuga ' };
    expect(quickLogPayload(form)).toEqual(
      buildQuickLogInput(form, TYPE, { id: 'o', code: 'X' }).payload,
    );
  });

  it('PATCH sobre el reporte existente conserva el hijo y no crea otro (mock)', () => {
    const s = loginAs(USERS.pilot);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const pending = s.post('/tickets/', {
      type_code: 'technical_report',
      title: `Reporte técnico · ${op.code}`,
      parent_id: op.id,
      payload: { description: 'Pendiente del piloto', has_finding: false },
    }).data;
    const children = () =>
      s.get('/tickets/', { parent_id: op.id, type_code: 'technical_report', open: 'true' }).data;
    const target = findOpenReport(children().data.filter((c: any) => c.id === pending.id));
    expect(target?.id).toBe(pending.id);
    const before = children().total;

    const form = { ...ok, hasFinding: true, note: 'Ruido en el motor' };
    const patched = s.patch(`/tickets/${pending.id}/`, { payload: quickLogPayload(form) });
    expect(patched.status).toBe(200);
    expect(patched.data.id).toBe(pending.id);
    expect(patched.data.payload).toMatchObject({
      actual_departure: '08:00',
      actual_arrival: '09:30',
      has_finding: true,
      description: 'Ruido en el motor',
    });
    const withPhoto = s.post(
      `/tickets/${pending.id}/attachments/`,
      { name: 'ala.png', mime: 'image/png', size: 8, data_url: PNG, field_key: 'photo' },
      'ql-p:a0',
    );
    expect(withPhoto.data.files).toHaveLength(1);
    expect(children().total).toBe(before);
  });

  it('con reporte existente, sin red, encola un update_ticket con la misma clave', async () => {
    const queue = new OfflineQueue(createMemoryStore(), async () => ({ ok: true, data: {} }));
    const input = buildQuickLogInput(ok, TYPE, { id: 'op-1', code: 'X' });
    const calls: string[] = [];
    const out = await submitQuickLog(
      {
        queue,
        userId: 'u-2',
        label: 'x',
        existing: { id: 'rep-9' },
        isOnline: () => false,
        sendUpdate: async (id) => {
          calls.push(id);
          return { ok: true as const, data: {} as never };
        },
      },
      input,
      [],
      'k-upd',
    );
    expect(out).toEqual({ queued: true });
    expect(calls).toEqual([]);
    const [item] = await queue.list('u-2');
    expect(item).toMatchObject({
      key: 'k-upd',
      kind: 'update_ticket',
      request: { ticketId: 'rep-9', body: { payload: input.payload } },
    });
  });

  it('con reporte existente y red, actualiza ese id y NO crea uno nuevo', async () => {
    const queue = new OfflineQueue(createMemoryStore(), async () => ({ ok: true, data: {} }));
    const calls: string[] = [];
    const out = await submitQuickLog(
      {
        queue,
        userId: 'u-2',
        label: 'x',
        existing: { id: 'rep-9' },
        isOnline: () => true,
        send: async () => {
          calls.push('create');
          return { ok: true as const, data: {} as never };
        },
        sendUpdate: async (id, _i, _f, key) => {
          calls.push(`update:${id}:${key}`);
          return { ok: true as const, data: {} as never };
        },
      },
      buildQuickLogInput(ok, TYPE, { id: 'op-1', code: 'X' }),
      [],
      'k-ok',
    );
    expect(out.queued).toBe(false);
    expect(calls).toEqual(['update:rep-9:k-ok']);
  });
});

describe('guardado sin señal', () => {
  const deps = (online: boolean, sent: string[]) => {
    const queue = new OfflineQueue(createMemoryStore(), async () => ({ ok: true, data: {} }));
    return {
      queue,
      cfg: {
        queue,
        userId: 'u-2',
        label: 'Bitácora · X',
        isOnline: () => online,
        send: async (_i: unknown, _f: unknown, key: string) => {
          sent.push(key);
          return { ok: true as const, data: { id: 't1' } as never };
        },
      },
    };
  };
  const input = buildQuickLogInput(ok, TYPE, { id: 'op-1', code: 'X' });

  it('sin red encola con la misma clave, el cuerpo y las fotos, y no envía', async () => {
    const sent: string[] = [];
    const { queue, cfg } = deps(false, sent);
    const photo = { name: 'a.png', mime: 'image/png', size: 8, data_url: PNG };
    const out = await submitQuickLog(cfg, input, [photo], 'key-1');
    expect(out).toEqual({ queued: true });
    expect(sent).toEqual([]);
    const [item] = await queue.list('u-2');
    expect(item).toMatchObject({
      key: 'key-1',
      kind: 'create_ticket',
      state: 'pending',
      request: { body: input, attachments: [photo] },
    });
  });

  it('con red envía con la clave y no encola', async () => {
    const sent: string[] = [];
    const { queue, cfg } = deps(true, sent);
    const out = await submitQuickLog(cfg, input, [], 'key-2');
    expect(out.queued).toBe(false);
    expect(sent).toEqual(['key-2']);
    expect(await queue.list('u-2')).toHaveLength(0);
  });

  it('un corte a mitad del envío (status 0) también encola, con la clave original', async () => {
    const { queue, cfg } = deps(true, []);
    const out = await submitQuickLog(
      {
        ...cfg,
        send: async () => ({ ok: false as const, status: 0, title: 'e', detail: 'sin red' }),
      },
      input,
      [],
      'key-3',
    );
    expect(out).toEqual({ queued: true });
    expect((await queue.list('u-2'))[0]?.key).toBe('key-3');
  });

  it('un rechazo del servidor (422) NO se encola: se muestra al usuario', async () => {
    const { queue, cfg } = deps(true, []);
    const out = await submitQuickLog(
      {
        ...cfg,
        send: async () => ({ ok: false as const, status: 422, title: 'e', detail: 'mal' }),
      },
      input,
      [],
      'key-4',
    );
    expect(out.queued).toBe(false);
    expect(await queue.list('u-2')).toHaveLength(0);
  });
});

describe('ayudas de pasaporte y manifiesto', () => {
  const f = (id: string, document_type: string, uploaded_at: string) =>
    ({ id, document_type, uploaded_at, name: id }) as never;
  it('el archivo recién subido es el que no estaba antes', () => {
    const before = [f('a', 'pasaporte', '1')];
    expect(addedFile(before, [...before, f('b', 'pasaporte', '2')])?.id).toBe('b');
    expect(addedFile(before, before)).toBeUndefined();
  });
  it('el manifiesto firmado es el más reciente de su categoría', () => {
    const files = [
      f('m1', 'manifiesto', '2026-01-01'),
      f('p', 'pasaporte', '2026-03-01'),
      f('m2', 'manifiesto', '2026-02-01'),
    ];
    expect(manifestFiles(files).map((x) => x.id)).toEqual(['m2', 'm1']);
  });
});
