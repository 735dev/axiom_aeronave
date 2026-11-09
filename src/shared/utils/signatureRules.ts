/**
 * Reglas de la firma digital. Las comparten la pantalla (para avisar antes de
 * enviar) y el servidor simulado (que es quien de verdad las hace cumplir):
 * validar solo en el cliente no protege nada.
 */
export const SIGNATURE_MAX_BYTES = 300 * 1024;
export const SIGNATURE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

export type SignatureProblem = 'type' | 'size' | 'empty';

/** `null` si la imagen sirve; si no, el motivo. */
export function signatureProblem(mime: string, bytes: number): SignatureProblem | null {
  if (!(SIGNATURE_MIME_TYPES as readonly string[]).includes(mime)) return 'type';
  if (bytes <= 0) return 'empty';
  if (bytes > SIGNATURE_MAX_BYTES) return 'size';
  return null;
}
