/**
 * Contexto de la petición en curso: la clave de idempotencia que trajo.
 *
 * Igual que el actor de auditoría, el mock atiende una petición a la vez. En
 * el backend esto es el contexto de la petición.
 */
let currentKey: string | undefined;

export function setIdempotencyKey(key: string | undefined) {
  currentKey = key;
}

export function currentIdempotencyKey(): string | undefined {
  return currentKey;
}
