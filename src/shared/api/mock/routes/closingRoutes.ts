import {
  ClosingBlocker,
  ClosingExpenseRow,
  ClosingMoneyBlock,
  ClosingRoleProgress,
  ClosingSigner,
  ClosingSignature,
  ClosingStamp,
  ClosingSummary,
  ClosingSupport,
  Decision,
  StepDef,
  Ticket,
  TicketType,
} from '@/features/tickets/types/ticket.types';
import { currentAuditActor } from '../auditDb';
import { folderIdFor } from '../blackbox';
import { computeTotals, conceptLabel } from '../totals';
import { adminState, effectivePermissionsFor, MockResponse } from './adminRoutes';

/** Pasos cuya decisión es una firma del cierre: los marca el tipo, no el código. */
export function signingSteps(type: TicketType | undefined): StepDef[] {
  return (type?.steps ?? []).filter((s) => s.requires_signature);
}

/** La firma vale si la decisión se cumplió y trae la rúbrica de quien firmó. */
function signedDecision(root: Ticket, stepCode: string): Decision | undefined {
  const d = root.decisions.find((x) => x.step_code === stepCode);
  return d?.decision === 'done' && d.signature_url ? d : undefined;
}

type TypeOf = (code: string) => TicketType | undefined;

function inExpediente(root: Ticket, all: Ticket[]): Ticket[] {
  return [root, ...all.filter((t) => t.parent_id === root.id)];
}

function money(children: Ticket[], typeOf: TypeOf): ClosingMoneyBlock {
  const totals = computeTotals(children, typeOf);
  return { base: totals.committed_base + totals.pending_base, by_currency: totals.by_currency };
}

function progressByRole(members: Ticket[], typeOf: TypeOf): ClosingRoleProgress[] {
  const groups = new Map<string, ClosingRoleProgress>();
  members.forEach((ticket) => {
    typeOf(ticket.type_code)?.steps.forEach((step) => {
      const key = step.role_id ?? 'none';
      const group = groups.get(key) ?? {
        role_id: step.role_id ?? null,
        role_name: step.role_name ?? 'Sin responsable',
        done: 0,
        total: 0,
        pending: [],
      };
      group.total += 1;
      // Cuenta cualquier decisión registrada: es el mismo criterio con que el
      // cierre exige los pasos obligatorios.
      if (ticket.decisions.some((d) => d.step_code === step.code)) group.done += 1;
      else group.pending.push(`${ticket.code} · ${step.name}`);
      groups.set(key, group);
    });
  });
  return [...groups.values()];
}

function supportsOf(members: Ticket[]): ClosingSupport[] {
  return members.flatMap((ticket) =>
    ticket.files.map((f) => ({
      ticket_id: ticket.id,
      ticket_code: ticket.code,
      file_id: f.id,
      document_type: f.document_type,
      name: f.name,
      mime: f.mime,
      size: f.size,
      filename: f.storage.filename,
      folder: f.storage.folder,
      uploaded_by: f.uploaded_by,
    })),
  );
}

function countsAsCommitted(ticket: Ticket, typeOf: TypeOf): boolean {
  const status = typeOf(ticket.type_code)?.statuses.find((s) => s.code === ticket.status_code);
  return status?.counts_as_committed ?? true;
}

/**
 * Lo que impide cerrar. La misma lista alimenta la pantalla y el PATCH de
 * cierre: si divergieran, la pantalla diría "listo" y el servidor diría no.
 */
export function closingBlockers(root: Ticket, all: Ticket[], typeOf: TypeOf): ClosingBlocker[] {
  const blockers: ClosingBlocker[] = [];
  const rootType = typeOf(root.type_code);
  rootType?.steps
    .filter(
      (s) =>
        s.required && !s.requires_signature && !root.decisions.some((d) => d.step_code === s.code),
    )
    .forEach((s) =>
      blockers.push({
        kind: 'pending_step',
        ticket_id: root.id,
        ticket_code: root.code,
        detail: s.name,
        step_code: s.code,
      }),
    );
  signingSteps(rootType)
    .filter((s) => s.required && !signedDecision(root, s.code))
    .forEach((s) =>
      blockers.push({
        kind: 'signature',
        ticket_id: root.id,
        ticket_code: root.code,
        detail: s.name,
        step_code: s.code,
        role_name: s.role_name,
      }),
    );

  const children = all.filter((t) => t.parent_id === root.id);
  children
    .filter((c) => !c.status_is_final && (typeOf(c.type_code)?.blocks_parent_close ?? false))
    .forEach((c) =>
      blockers.push({ kind: 'unresolved_child', ticket_id: c.id, ticket_code: c.code }),
    );

  children
    .filter((c) => {
      const type = typeOf(c.type_code);
      const needsFile = type?.fields.some((f) => f.type === 'file') ?? false;
      return needsFile && Boolean(c.money) && countsAsCommitted(c, typeOf) && c.files.length === 0;
    })
    .forEach((c) =>
      blockers.push({ kind: 'expense_without_support', ticket_id: c.id, ticket_code: c.code }),
    );

  inExpediente(root, all).forEach((t) =>
    t.files
      .filter((f) => f.extraction?.status === 'extracted')
      .forEach((f) =>
        blockers.push({
          kind: 'receipt_awaiting_validation',
          ticket_id: t.id,
          ticket_code: t.code,
          detail: f.name,
        }),
      ),
  );
  return blockers;
}

/** Texto del bloqueo para el 422, o `undefined` si no hay nada que lo impida. */
export function closingBlockMessage(
  root: Ticket,
  all: Ticket[],
  typeOf: TypeOf,
  skip: ClosingBlocker['kind'][],
): string | undefined {
  const hard = closingBlockers(root, all, typeOf).filter((b) => !skip.includes(b.kind));
  const noSupport = hard.filter((b) => b.kind === 'expense_without_support');
  if (noSupport.length > 0) {
    return `No se puede cerrar: ${noSupport.map((b) => b.ticket_code).join(', ')} no tiene(n) soporte cargado.`;
  }
  const awaiting = hard.filter((b) => b.kind === 'receipt_awaiting_validation');
  if (awaiting.length > 0) {
    return `No se puede cerrar: hay comprobantes sin validar (${[...new Set(awaiting.map((b) => b.ticket_code))].join(', ')}).`;
  }
  return undefined;
}

/** Firmas utilizables para sellar, o el motivo por el que falta alguna. */
export function signatureProblemFor(root: Ticket, type: TicketType): string | undefined {
  for (const step of signingSteps(type).filter((s) => s.required)) {
    const decision = root.decisions.find((d) => d.step_code === step.code);
    if (!decision || decision.decision !== 'done') {
      return `No se puede cerrar: falta la firma de ${step.role_name ?? step.name}.`;
    }
    if (!decision.signature_url) {
      return 'No se puede cerrar: quien firma debe cargar su firma en su perfil y volver a firmar.';
    }
  }
  return undefined;
}

/** Sello inmutable del cierre. Solo existe si todas las firmas obligatorias traen rúbrica. */
export function buildClosingStamp(
  root: Ticket,
  type: TicketType,
  all: Ticket[],
  typeOf: TypeOf,
): ClosingStamp | undefined {
  const steps = signingSteps(type);
  const signatures: ClosingSignature[] = steps.flatMap((step) => {
    const d = signedDecision(root, step.code);
    return d
      ? [
          {
            step_code: step.code,
            step_name: step.name,
            role_name: step.role_name ?? '',
            user_name: d.decided_by,
            signed_at: d.decided_at,
            signature_url: d.signature_url as string,
          },
        ]
      : [];
  });
  if (steps.length > 0 && signatures.length < steps.filter((s) => s.required).length) {
    return undefined;
  }
  // El último en firmar es quien deja constancia en el sello de un solo firmante.
  const last = [...signatures].sort((a, b) => a.signed_at.localeCompare(b.signed_at)).at(-1);
  const members = inExpediente(root, all);
  return {
    signed_by: last?.user_name ?? '',
    signed_role: last?.role_name ?? '',
    signature_url: last?.signature_url,
    signed_at: last?.signed_at ?? new Date().toISOString(),
    signatures,
    totals: computeTotals(
      all.filter((t) => t.parent_id === root.id),
      typeOf,
    ),
    files_count: members.reduce((n, t) => n + t.files.length, 0),
    folder: folderIdFor(root.code, root.created_at),
  };
}

function summarize(root: Ticket, all: Ticket[], typeOf: TypeOf): ClosingSummary {
  const members = inExpediente(root, all);
  const children = members.slice(1);
  const rootType = typeOf(root.type_code);
  const blockers = closingBlockers(root, all, typeOf);

  const expenses: ClosingExpenseRow[] = children
    .filter((c) => c.money)
    .map((c) => {
      const type = typeOf(c.type_code);
      return {
        ticket_id: c.id,
        code: c.code,
        concept: conceptLabel(type, c).label,
        amount: c.money?.amount ?? 0,
        currency: c.money?.currency ?? '',
        amount_base: c.money?.amount_base ?? 0,
        status: c.status_name,
        counts: countsAsCommitted(c, typeOf),
        has_support: c.files.length > 0,
      };
    });

  const supports = supportsOf(members);
  const byType = new Map<string, number>();
  supports.forEach((s) => byType.set(s.document_type, (byType.get(s.document_type) ?? 0) + 1));

  const me = adminState.users.find((u) => u.id === currentAuditActor().id);
  const canSignAny =
    me !== undefined && effectivePermissionsFor(me.id).includes('tickets.decide_any');
  const signers: ClosingSigner[] = signingSteps(rootType).map((step) => {
    const d = signedDecision(root, step.code);
    return {
      step_code: step.code,
      step_name: step.name,
      role_code: adminState.roles.find((r) => r.id === step.role_id)?.code ?? '',
      role_name: step.role_name ?? '',
      required: step.required,
      signed: Boolean(d),
      signed_by_name: d?.decided_by ?? null,
      signed_at: d?.decided_at ?? null,
      can_sign: Boolean(me) && (me?.role_id === step.role_id || canSignAny),
      has_signature: Boolean(me?.signature_url),
    };
  });

  return {
    ticket_id: root.id,
    ticket_code: root.code,
    closed: root.status_is_final,
    stamp: root.closing ?? null,
    progress: progressByRole(members, typeOf),
    expenses,
    totals: computeTotals(children, typeOf),
    confirmed: money(
      children.filter((c) => c.status_is_final),
      typeOf,
    ),
    in_progress: money(
      children.filter((c) => !c.status_is_final),
      typeOf,
    ),
    supports,
    supports_by_type: [...byType.entries()].map(([document_type, count]) => ({
      document_type,
      count,
    })),
    blockers,
    ready: blockers.length === 0,
    signers,
  };
}

/** `GET /tickets/{id}/closing/`: solo tickets raíz; cualquier otro id es 404. */
export function routeClosing(
  method: string,
  path: string,
  all: Ticket[],
  typeOf: TypeOf,
): MockResponse | null {
  const m = /^\/tickets\/([^/]+)\/closing\/$/.exec(path);
  if (!m || method !== 'get') return null;
  const root = all.find((t) => t.id === m[1]);
  if (!root || !root.type_is_root) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  return { status: 200, data: summarize(root, all, typeOf) };
}
