import { describe, expect, it } from 'vitest';
import { PNG, USERS, loginAs } from '@/test/mockApi';
import { foldText, normalizeDocument } from './passengers';
import { routeMockRequest } from './router';

type S = ReturnType<typeof loginAs>;
const ops = (s: S) => s.get('/tickets/', { limit: '200', is_root: 'true' }).data.data as any[];
const setPax = (s: S, id: string, list: unknown[]) =>
  s.post(`/tickets/${id}/passengers/`, { passengers: JSON.stringify(list) });
const openOps = (s: S) => ops(s).filter((o) => !o.status_is_final);
const search = (s: S, q: string) => s.get('/passengers/search/', { q });

const MARIA = {
  id: 'p1',
  full_name: 'María José Pérez',
  document: 'V-12.345.678',
  nationality: 'VE',
};
const JUAN = { id: 'p2', full_name: 'Juan Rodríguez', document: 'E 87.654.321' };

describe('normalización', () => {
  it('el documento ignora puntos, espacios, guiones y mayúsculas', () => {
    expect(normalizeDocument('V-12.345.678')).toBe('V12345678');
    expect(normalizeDocument(' v 12 345 678 ')).toBe('V12345678');
  });
  it('el nombre ignora tildes y mayúsculas', () => {
    expect(foldText('MARÍA José')).toBe('maria jose');
  });
});

describe('búsqueda de pasajeros', () => {
  it('"V-12.345.678" encuentra al pasajero guardado como "V12345678" y viceversa', () => {
    const s = loginAs(USERS.superuser);
    const [a, b] = ops(s);
    setPax(s, a.id, [{ ...MARIA, document: 'V12345678' }]);
    setPax(s, b.id, [{ ...MARIA, document: 'v-12.345.678' }]);
    const r = search(s, 'V-12.345.678');
    expect(r.status).toBe(200);
    expect(r.data.data).toHaveLength(1);
    expect(r.data.data[0].operations.map((o: any) => o.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('el nombre se busca sin tildes ni mayúsculas', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [MARIA]);
    expect(search(s, 'maria jose').data.data).toHaveLength(1);
    expect(search(s, 'PÉREZ').data.data).toHaveLength(1);
  });

  it('devuelve código, fecha, ruta y estado de cada operación', () => {
    const s = loginAs(USERS.superuser);
    const op = ops(s)[0];
    setPax(s, op.id, [MARIA]);
    const [hit] = search(s, 'maria').data.data[0].operations;
    expect(hit).toMatchObject({
      id: op.id,
      code: op.code,
      status_code: op.status_code,
      status_name: op.status_name,
    });
    expect(hit.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hit.route).toBe(`${op.payload.origin} → ${op.payload.destination}`);
  });

  it('una consulta sin coincidencias devuelve lista vacía, no error', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [MARIA]);
    const r = search(s, 'zzzz inexistente');
    expect(r.status).toBe(200);
    expect(r.data.data).toEqual([]);
  });

  it('consulta vacía lista a los más recientes', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [MARIA, JUAN]);
    expect(search(s, '   ').data.data.length).toBeGreaterThan(0);
  });

  it('un nombre corto no cuela documentos que contienen esas letras', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [{ id: 'x', full_name: 'Otro Nombre', document: 'ANA123456' }]);
    expect(search(s, 'ana').data.data).toEqual([]);
  });

  it.each(['.*(', '(a+)+$', '[', '\\', '$where', '(?<=', '.*.*.*.*.*.*.*.*x'])(
    'entrada con sintaxis de regex %j no lanza ni se interpreta',
    (q) => {
      const s = loginAs(USERS.superuser);
      setPax(s, ops(s)[0].id, [MARIA, { ...JUAN, full_name: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!' }]);
      const started = Date.now();
      const r = search(s, q);
      expect(r.status).toBe(200);
      expect(r.data.data).toEqual([]);
      expect(Date.now() - started).toBeLessThan(500);
    },
  );

  it('".*" no coincide con todo: se trata como texto literal', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [MARIA, JUAN]);
    expect(search(s, '.*').data.data).toEqual([]);
  });

  it('dos personas distintas no se mezclan', () => {
    const s = loginAs(USERS.superuser);
    setPax(s, ops(s)[0].id, [MARIA, JUAN]);
    const r = search(s, 'rodr');
    expect(r.data.data).toHaveLength(1);
    expect(r.data.data[0].full_name).toBe('Juan Rodríguez');
  });
});

describe('alcance por permisos de lectura', () => {
  const setPerms = (role: string, permissions: string[]) =>
    expect(loginAs(USERS.superuser).patch(`/roles/${role}/`, { permissions }).status).toBe(200);

  it('quien no puede leer operaciones recibe 404 y ningún dato', () => {
    const admin = loginAs(USERS.superuser);
    setPax(admin, ops(admin)[0].id, [MARIA]);
    setPerms('r-3', ['notifications.view']);
    const r = search(loginAs(USERS.pilot), 'maria');
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.data)).not.toContain('María');
  });

  it('con permiso de lectura solo del tipo operación sí ve los resultados', () => {
    const admin = loginAs(USERS.superuser);
    setPax(admin, ops(admin)[0].id, [MARIA]);
    setPerms('r-3', ['notifications.view', 'tickets.view.operation']);
    const r = search(loginAs(USERS.pilot), 'maria');
    expect(r.status).toBe(200);
    expect(r.data.data).toHaveLength(1);
  });

  it('el permiso de lectura de OTRO tipo no abre las operaciones', () => {
    const admin = loginAs(USERS.superuser);
    setPax(admin, ops(admin)[0].id, [MARIA]);
    setPerms('r-3', ['notifications.view', 'tickets.view.expense']);
    expect(search(loginAs(USERS.pilot), 'maria').status).toBe(404);
  });

  it('sin sesión (token ausente) la búsqueda responde 401', () => {
    const r = routeMockRequest({
      method: 'get',
      path: '/passengers/search/',
      query: new URLSearchParams({ q: 'maria' }),
      body: undefined,
    });
    expect(r.status).toBe(401);
  });
});

describe('pasaporte enlazado al pasajero', () => {
  const upload = (s: S, id: string, key = 'passport') =>
    s.post(`/tickets/${id}/attachments/`, {
      name: 'pasaporte.png',
      mime: 'image/png',
      size: 8,
      data_url: PNG,
      field_key: key,
    });

  it('el archivo se sube como pasaporte y queda enlazado en el pasajero', () => {
    const s = loginAs(USERS.superuser);
    const op = openOps(s)[0];
    const up = upload(s, op.id);
    expect(up.status).toBe(201);
    const file = up.data.files.at(-1);
    expect(file.document_type).toBe('pasaporte');
    const saved = setPax(s, op.id, [{ ...MARIA, passport_file_id: file.id }]);
    expect(saved.data[0].passport_file_id).toBe(file.id);
    expect(s.get(`/tickets/${op.id}/passengers/`).data[0].passport_file_id).toBe(file.id);
  });

  it('el resultado de la búsqueda trae el pasaporte para mostrarlo', () => {
    const s = loginAs(USERS.superuser);
    const op = openOps(s)[0];
    const file = upload(s, op.id).data.files.at(-1);
    setPax(s, op.id, [{ ...MARIA, passport_file_id: file.id }]);
    expect(search(s, 'V12345678').data.data[0].passport).toEqual({
      ticket_id: op.id,
      file_id: file.id,
    });
  });

  it('un archivo de OTRO expediente no se puede enlazar como pasaporte', () => {
    const s = loginAs(USERS.superuser);
    const a = openOps(s)[0];
    const b = s.post('/tickets/', {
      type_code: 'operation',
      title: 'Otra operación',
      payload: { date: '2026-09-01', origin: 'CCS', destination: 'MAR', aircraft: 'YV2323' },
    }).data;
    expect(b.id).not.toBe(a.id);
    const foreign = upload(s, b.id).data.files.at(-1);
    const saved = setPax(s, a.id, [{ ...MARIA, passport_file_id: foreign.id }]);
    expect(saved.status).toBe(200);
    expect(saved.data[0].passport_file_id).toBeUndefined();
  });

  it('el enlace de descarga del pasaporte se firma con el endpoint de soportes', () => {
    const s = loginAs(USERS.superuser);
    const op = openOps(s)[0];
    const file = upload(s, op.id).data.files.at(-1);
    const link = s.get(`/tickets/${op.id}/attachments/${file.id}/download/`);
    expect(link.status).toBe(200);
    expect(link.data.url).toMatch(/^data:image\//);
  });
});
