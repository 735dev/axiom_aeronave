import { describe, expect, it } from 'vitest';
import { loginAs } from '@/test/mockApi';

const base = { date: '2026-12-10', origin: 'CCS', destination: 'PZO' };

describe('coherencia de marca, modelo y matrícula (simulador)', () => {
  const ops = () => loginAs('operaciones@transvalor.com');
  const create = (payload: Record<string, unknown>) =>
    ops().post('/tickets/', { type_code: 'operation', title: 'Operación', payload: { ...base, ...payload } });

  it('acepta una combinación coherente', () => {
    const res = create({ aircraft: 'YV2323', aircraft_brand: 'beechcraft', aircraft_model: 'king_air_200' });
    expect(res.status).toBe(201);
  });

  it('acepta marca, modelo y matrícula vacíos salvo la matrícula obligatoria', () => {
    expect(create({ aircraft: 'YV2323' }).status).toBe(201);
  });

  it('rechaza un modelo que no es de la marca, con el error en el modelo', () => {
    const res = create({ aircraft: 'YV2528', aircraft_brand: 'beechcraft', aircraft_model: 'cheyenne' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.data.errors)).toEqual(['aircraft_model']);
  });

  it('rechaza una matrícula que no es del modelo, con el error en la matrícula', () => {
    const res = create({ aircraft: 'YV2323', aircraft_brand: 'piper', aircraft_model: 'cheyenne' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.data.errors)).toEqual(['aircraft']);
  });

  it('rechaza una marca o un modelo que no existen en el catálogo', () => {
    const res = create({ aircraft: 'YV2323', aircraft_brand: 'cessna', aircraft_model: 'caravan' });
    expect(res.status).toBe(422);
    // La matrícula tampoco corresponde a un modelo que no existe.
    expect(Object.keys(res.data.errors).sort()).toEqual(['aircraft', 'aircraft_brand', 'aircraft_model']);
  });

  it('también valida al editar el expediente', () => {
    const s = ops();
    const created = s.post('/tickets/', {
      type_code: 'operation',
      title: 'Operación',
      payload: { ...base, aircraft: 'YV2323', aircraft_brand: 'beechcraft', aircraft_model: 'king_air_200' },
    });
    expect(created.status).toBe(201);
    const bad = s.patch(`/tickets/${created.data.id}/`, { payload: { aircraft_model: 'cheyenne' } });
    expect(bad.status).toBe(422);
    expect(bad.data.errors.aircraft_model).toBeTruthy();
    const good = s.patch(`/tickets/${created.data.id}/`, {
      payload: { aircraft: 'YV2528', aircraft_brand: 'piper', aircraft_model: 'cheyenne' },
    });
    expect(good.status).toBe(200);
  });
});
