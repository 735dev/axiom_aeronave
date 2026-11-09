import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_HEADER, newIdempotencyKey } from './idempotency';

const realCrypto = globalThis.crypto;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('clave de idempotencia', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tiene forma de UUID v4', () => {
    expect(newIdempotencyKey()).toMatch(UUID_V4);
  });

  it('no se repite en 2000 generaciones', () => {
    const keys = new Set(Array.from({ length: 2000 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(2000);
  });

  it('sin randomUUID (contexto no seguro) usa el generador criptográfico y mantiene el formato', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a),
    });
    const key = newIdempotencyKey();
    expect(key).toMatch(UUID_V4);
  });

  it('el respaldo tampoco repite claves', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a),
    });
    const keys = new Set(Array.from({ length: 500 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(500);
  });

  it('nunca usa Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a),
    });
    newIdempotencyKey();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('la cabecera se llama como dice el contrato', () => {
    expect(IDEMPOTENCY_HEADER).toBe('Idempotency-Key');
  });
});
