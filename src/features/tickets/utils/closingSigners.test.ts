import { describe, expect, it } from 'vitest';
import type { ClosingBlocker, ClosingSigner } from '../types/ticket.types';
import {
  blockersWithoutSignatures,
  mySignableSteps,
  signerState,
  signersProgress,
} from './closingSigners';

const signer = (over: Partial<ClosingSigner>): ClosingSigner => ({
  step_code: 'sign_captain',
  step_name: 'Firma del capitán',
  role_code: 'pilot',
  role_name: 'Piloto',
  required: true,
  signed: false,
  signed_by_name: null,
  signed_at: null,
  can_sign: false,
  has_signature: true,
  ...over,
});

const four: ClosingSigner[] = [
  signer({ signed: true, signed_by_name: 'Cap. Luis', signed_at: '2026-08-19T10:00:00Z' }),
  signer({ step_code: 'sign_maintenance', role_code: 'maintenance', role_name: 'Mantenimiento' }),
  signer({ step_code: 'sign_avsec', role_code: 'avsec', role_name: 'Coordinación AVSEC' }),
  signer({ step_code: 'sign_general', role_code: 'executive', role_name: 'Gerencia General' }),
];

describe('signersProgress', () => {
  it('cuenta las firmas puestas y lista las que faltan en orden', () => {
    const p = signersProgress(four);
    expect(p.signed).toBe(1);
    expect(p.total).toBe(4);
    expect(p.pending.map((s) => s.step_code)).toEqual([
      'sign_maintenance',
      'sign_avsec',
      'sign_general',
    ]);
  });

  it('un firmante no obligatorio no cuenta para el total', () => {
    const p = signersProgress([...four, signer({ step_code: 'extra', required: false })]);
    expect(p.total).toBe(4);
  });

  it('sin firmantes no hay nada pendiente', () => {
    expect(signersProgress([])).toEqual({ signed: 0, total: 0, pending: [] });
  });
});

describe('blockersWithoutSignatures', () => {
  const blockers: ClosingBlocker[] = [
    { kind: 'signature', ticket_id: 't', ticket_code: 'T', step_code: 'sign_avsec', role_name: 'AVSEC' },
    { kind: 'pending_step', ticket_id: 't', ticket_code: 'T', step_code: 'sign_general', detail: 'x' },
    { kind: 'pending_step', ticket_id: 't', ticket_code: 'T', step_code: 'planning', detail: 'Planificación' },
    { kind: 'unresolved_child', ticket_id: 'c', ticket_code: 'C' },
  ];

  it('quita las firmas y los pasos de firma, y deja el resto', () => {
    const rest = blockersWithoutSignatures(blockers, four);
    expect(rest.map((b) => b.kind + ':' + (b.step_code ?? ''))).toEqual([
      'pending_step:planning',
      'unresolved_child:',
    ]);
  });
});

describe('signerState / mySignableSteps', () => {
  it('distingue firmado, propio por firmar y ajeno pendiente', () => {
    expect(signerState(four[0]!)).toBe('signed');
    expect(signerState(signer({ can_sign: true }))).toBe('mine');
    expect(signerState(signer({ can_sign: false }))).toBe('pending');
  });

  it('solo ofrece firmar lo propio que falta', () => {
    const list = [
      signer({ signed: true, can_sign: true }),
      signer({ step_code: 'b', can_sign: true }),
      signer({ step_code: 'c', can_sign: false }),
    ];
    expect(mySignableSteps(list).map((s) => s.step_code)).toEqual(['b']);
  });
});
