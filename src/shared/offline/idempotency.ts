/**
 * Clave de idempotencia: identifica UNA acción del usuario, no un intento.
 *
 * Se genera antes del primer envío y se reutiliza en cada reintento. Si el
 * primer intento llegó al servidor pero la respuesta se perdió (señal que cae
 * a mitad de camino), el reintento lleva la misma clave y el servidor devuelve
 * lo ya creado en lugar de crear un segundo gasto.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // `randomUUID` exige contexto seguro. Respaldo con el generador criptográfico;
  // nunca Math.random, que es predecible.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
