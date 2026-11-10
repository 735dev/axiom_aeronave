import { ClosingBlocker, ClosingSigner } from '../types/ticket.types';

export interface SignersProgress {
  signed: number;
  total: number;
  pending: ClosingSigner[];
}

/** Cuántas firmas hay y cuáles faltan, solo contando los pasos obligatorios. */
export function signersProgress(signers: ClosingSigner[]): SignersProgress {
  const required = signers.filter((s) => s.required);
  const pending = required.filter((s) => !s.signed);
  return { signed: required.length - pending.length, total: required.length, pending };
}

/**
 * Bloqueos que no son de firma. Las firmas faltantes ya se ven en la lista de
 * firmantes; repetirlas como bloqueo duplicaría el aviso.
 */
export function blockersWithoutSignatures(
  blockers: ClosingBlocker[],
  signers: ClosingSigner[],
): ClosingBlocker[] {
  const signingSteps = new Set(signers.map((s) => s.step_code));
  return blockers.filter(
    (b) => b.kind !== 'signature' && !(b.kind === 'pending_step' && signingSteps.has(b.step_code ?? '')),
  );
}

/** Quien consulta puede firmar algo que aún falta. */
export function mySignableSteps(signers: ClosingSigner[]): ClosingSigner[] {
  return signers.filter((s) => !s.signed && s.can_sign);
}

/** Estado de un firmante para pintar la fila. */
export type SignerState = 'signed' | 'mine' | 'pending';

export function signerState(signer: ClosingSigner): SignerState {
  if (signer.signed) return 'signed';
  return signer.can_sign ? 'mine' : 'pending';
}
