import { beforeEach, describe, expect, it } from 'vitest';
import { ApiResult } from '@/shared/api/types';
import { createMemoryStore } from './idbStore';
import { OfflineQueue, QueuedItem, Sender, submitOrQueue } from './queue';
import { setOnlineForTests } from './network';
import { onSynced } from './syncEvents';

const OK: ApiResult<unknown> = { ok: true, data: {} };
const fail = (status: number, detail = 'x'): ApiResult<unknown> => ({
  ok: false,
  status,
  title: 't',
  detail,
});

type Seed = Omit<QueuedItem, 'attempts' | 'state' | 'createdAt'>;
let n = 0;
const item = (over: Partial<Seed> = {}): Seed => ({
  key: `k${(n += 1)}`,
  kind: 'create_ticket',
  userId: 'u1',
  label: `item ${n}`,
  request: { body: {} },
  ...over,
});
const wait = () => new Promise((r) => setTimeout(r, 3));

describe('cola de envíos pendientes', () => {
  let sent: string[];
  let reply: (i: QueuedItem) => ApiResult<unknown>;
  let queue: OfflineQueue;

  beforeEach(() => {
    sent = [];
    reply = () => OK;
    const send: Sender = async (i) => {
      sent.push(i.key);
      return reply(i);
    };
    queue = new OfflineQueue(createMemoryStore(), send);
  });

  it('envía lo pendiente y lo saca de la cola', async () => {
    await queue.enqueue(item({ key: 'a' }));
    const rep = await queue.flush('u1');
    expect(rep).toMatchObject({ sent: 1, failed: 0, remaining: 0, interrupted: false });
    expect(sent).toEqual(['a']);
    expect(await queue.list('u1')).toHaveLength(0);
  });

  it('respeta el orden en que se encolaron', async () => {
    await queue.enqueue(item({ key: 'primero' }));
    await wait();
    await queue.enqueue(item({ key: 'segundo' }));
    await wait();
    await queue.enqueue(item({ key: 'tercero' }));
    await queue.flush('u1');
    expect(sent).toEqual(['primero', 'segundo', 'tercero']);
  });

  it.each([0, 408, 429, 500, 502, 503])(
    'un %i es pasajero: se corta y se conserva',
    async (status) => {
      await queue.enqueue(item({ key: 'a' }));
      await wait();
      await queue.enqueue(item({ key: 'b' }));
      reply = () => fail(status);
      const rep = await queue.flush('u1');
      expect(rep.interrupted).toBe(true);
      expect(sent).toEqual(['a']); // no insiste con el resto sin red
      const left = await queue.list('u1');
      expect(left).toHaveLength(2);
      expect(left[0]).toMatchObject({ state: 'pending', attempts: 1 });
    },
  );

  it.each([400, 403, 404, 409, 413, 422])(
    'un %i es rechazo: queda como fallido con su motivo',
    async (status) => {
      await queue.enqueue(item({ key: 'a' }));
      reply = () => fail(status, 'motivo del servidor');
      const rep = await queue.flush('u1');
      expect(rep).toMatchObject({ failed: 1, sent: 0, interrupted: false });
      const [left] = await queue.list('u1');
      expect(left).toMatchObject({ state: 'failed', error: 'motivo del servidor', attempts: 1 });
    },
  );

  it('un fallido no se reintenta solo', async () => {
    await queue.enqueue(item({ key: 'a' }));
    reply = () => fail(422);
    await queue.flush('u1');
    sent.length = 0;
    await queue.flush('u1');
    expect(sent).toEqual([]);
  });

  it('un rechazo no detiene los envíos que siguen', async () => {
    await queue.enqueue(item({ key: 'malo' }));
    await wait();
    await queue.enqueue(item({ key: 'bueno' }));
    reply = (i) => (i.key === 'malo' ? fail(422) : OK);
    const rep = await queue.flush('u1');
    expect(rep).toMatchObject({ sent: 1, failed: 1 });
    expect(sent).toEqual(['malo', 'bueno']);
  });

  it('con la sesión vencida (401) se detiene y conserva todo', async () => {
    await queue.enqueue(item({ key: 'a' }));
    reply = () => fail(401);
    const rep = await queue.flush('u1');
    expect(rep.interrupted).toBe(true);
    expect((await queue.list('u1'))[0]?.state).toBe('pending');
  });

  it('retryFailed devuelve los rechazados a pendiente y se pueden reenviar', async () => {
    await queue.enqueue(item({ key: 'a' }));
    reply = () => fail(422);
    await queue.flush('u1');
    reply = () => OK;
    await queue.retryFailed('u1');
    expect((await queue.list('u1'))[0]?.state).toBe('pending');
    expect(await queue.flush('u1')).toMatchObject({ sent: 1 });
  });

  it('descartar quita solo ese elemento', async () => {
    await queue.enqueue(item({ key: 'a' }));
    await queue.enqueue(item({ key: 'b' }));
    await queue.discard('u1', 'a');
    expect((await queue.list('u1')).map((i) => i.key)).toEqual(['b']);
  });

  it('otro usuario no ve ni envía lo ajeno', async () => {
    await queue.enqueue(item({ key: 'mio', userId: 'u1' }));
    await queue.enqueue(item({ key: 'ajeno', userId: 'u2' }));
    expect((await queue.list('u1')).map((i) => i.key)).toEqual(['mio']);
    await queue.flush('u2');
    expect(sent).toEqual(['ajeno']);
    expect((await queue.list('u1')).map((i) => i.key)).toEqual(['mio']);
  });

  it('dos envíos simultáneos comparten una sola corrida', async () => {
    await queue.enqueue(item({ key: 'a' }));
    const [r1, r2] = await Promise.all([queue.flush('u1'), queue.flush('u1')]);
    expect(r1).toBe(r2);
    expect(sent).toEqual(['a']);
  });

  it('tras terminar una corrida se puede iniciar otra', async () => {
    await queue.enqueue(item({ key: 'a' }));
    await queue.flush('u1');
    await queue.enqueue(item({ key: 'b' }));
    expect(await queue.flush('u1')).toMatchObject({ sent: 1 });
    expect(sent).toEqual(['a', 'b']);
  });

  it('avisa a los suscriptores cuando cambia la cola y deja de avisar al darse de baja', async () => {
    const seen: number[] = [];
    const off = queue.subscribe((items) => seen.push(items.length));
    await queue.enqueue(item({ key: 'a' }));
    await queue.flush('u1');
    off();
    await queue.enqueue(item({ key: 'b' }));
    expect(seen).toEqual([1, 0]);
  });

  it('conserva en la cola los soportes que viajan con el registro', async () => {
    await queue.enqueue(
      item({ key: 'a', request: { body: {}, attachments: [{ name: 'f.jpg' }] } }),
    );
    expect((await queue.list('u1'))[0]?.request.attachments).toEqual([{ name: 'f.jpg' }]);
  });
});

describe('submitOrQueue', () => {
  let queue: OfflineQueue;
  beforeEach(() => {
    queue = new OfflineQueue(createMemoryStore(), async () => OK);
  });

  it('sin conexión encola sin intentar el envío', async () => {
    let attempts = 0;
    const out = await submitOrQueue(
      queue,
      item({ key: 'a' }),
      async () => {
        attempts += 1;
        return OK;
      },
      () => false,
    );
    expect(out).toEqual({ queued: true });
    expect(attempts).toBe(0);
    expect(await queue.list('u1')).toHaveLength(1);
  });

  it('con conexión y éxito no encola', async () => {
    const out = await submitOrQueue(
      queue,
      item(),
      async () => OK,
      () => true,
    );
    expect(out.queued).toBe(false);
    expect(await queue.list('u1')).toHaveLength(0);
  });

  it('con conexión pero sin respuesta (status 0) encola con la MISMA clave', async () => {
    const out = await submitOrQueue(
      queue,
      item({ key: 'misma' }),
      async () => fail(0),
      () => true,
    );
    expect(out.queued).toBe(true);
    expect((await queue.list('u1'))[0]?.key).toBe('misma');
  });

  it.each([400, 401, 403, 404, 409, 422, 500])(
    'un %i se muestra y no se encola',
    async (status) => {
      const out = await submitOrQueue(
        queue,
        item(),
        async () => fail(status),
        () => true,
      );
      expect(out.queued).toBe(false);
      expect(await queue.list('u1')).toHaveLength(0);
    },
  );
});

describe('red caída con el sistema diciendo "hay red" (modo avión en Android)', () => {
  it('un fallo de red encola una sola vez y el reenvío no duplica el alta', async () => {
    const created = new Map<string, number>();
    let down = true;
    const send: Sender = async (i) => {
      if (down) return fail(0, 'errors.network');
      created.set(i.key, (created.get(i.key) ?? 0) + 1);
      return OK;
    };
    const queue = new OfflineQueue(createMemoryStore(), send);
    const events: number[] = [];
    const off = onSynced((n) => events.push(n));

    const out = await submitOrQueue(
      queue,
      item({ key: 'gasto' }),
      () => send(item({ key: 'gasto' }) as QueuedItem),
      () => true,
    );
    expect(out).toEqual({ queued: true });
    expect(await queue.list('u1')).toHaveLength(1);

    // Sigue sin red: el barrido no envía ni descarta.
    expect(await queue.flush('u1')).toMatchObject({ sent: 0, interrupted: true, remaining: 1 });
    expect(events).toEqual([]);

    down = false;
    expect(await queue.flush('u1')).toMatchObject({ sent: 1, remaining: 0 });
    // Un segundo barrido (p. ej. evento de red + temporizador) no vuelve a crear.
    await queue.flush('u1');
    expect(created.get('gasto')).toBe(1);
    expect(events).toEqual([1]);
    off();
  });

  it('una excepción del envío cuenta como sin red y se encola', async () => {
    const queue = new OfflineQueue(createMemoryStore(), async () => OK);
    const out = await submitOrQueue(
      queue,
      item({ key: 'x' }),
      async () => {
        throw new Error('boom');
      },
      () => true,
    );
    expect(out).toEqual({ queued: true });
    expect((await queue.list('u1'))[0]?.key).toBe('x');
  });

  it('por defecto consulta la fuente única de red', async () => {
    const queue = new OfflineQueue(createMemoryStore(), async () => OK);
    setOnlineForTests(false);
    let attempts = 0;
    const out = await submitOrQueue(queue, item(), async () => {
      attempts += 1;
      return OK;
    });
    setOnlineForTests(null);
    expect(out.queued).toBe(true);
    expect(attempts).toBe(0);
  });

  it('no avisa de sincronización si no se envió nada', async () => {
    const queue = new OfflineQueue(createMemoryStore(), async () => fail(500));
    const events: number[] = [];
    const off = onSynced((n) => events.push(n));
    await queue.enqueue(item());
    await queue.flush('u1');
    off();
    expect(events).toEqual([]);
  });
});
