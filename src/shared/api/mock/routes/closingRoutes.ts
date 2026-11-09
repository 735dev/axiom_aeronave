import {
  ClosingBlocker,
  ClosingExpenseRow,
  ClosingMoneyBlock,
  ClosingRoleProgress,
  ClosingStamp,
  ClosingSummary,
  ClosingSupport,
  Ticket,
  TicketType,
} from '@/features/tickets/types/ticket.types';
import { currentAuditActor } from '../auditDb';
import { folderIdFor } from '../blackbox';
import { computeTotals, conceptLabel } from '../totals';
import { adminState, effectivePermissionsFor, MockResponse } from './adminRoutes';

/** Paso cuya decisión es la firma del cierre. */
export const SIGNATURE_STEP = 'signature';

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
    .filter((s) => s.required && !root.decisions.some((d) => d.step_code === s.code))
    .forEach((s) =>
      blockers.push({
        kind: 'pending_step',
        ticket_id: root.id,
        ticket_code: root.code,
        detail: s.name,
        step_code: s.code,
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

/** Decisión de firma utilizable para sellar, o el motivo por el que no hay. */
export function signatureProblemFor(root: Ticket, type: TicketType): string | undefined {
  if (!type.steps.some((s) => s.code === SIGNATURE_STEP)) return undefined;
  const decision = root.decisions.find((d) => d.step_code === SIGNATURE_STEP);
  if (!decision || decision.decision !== 'done') {
    return 'No se puede cerrar: falta la firma de cierre de quien corresponda.';
  }
  if (!decision.signature_url) {
    return 'No se puede cerrar: quien firma debe cargar su firma en su perfil y volver a firmar.';
  }
  return undefined;
}

/** Sello inmutable del cierre. Solo existe si la decisión de firma trae rúbrica. */
export function buildClosingStamp(
  root: Ticket,
  type: TicketType,
  all: Ticket[],
  typeOf: TypeOf,
): ClosingStamp | undefined {
  const decision = root.decisions.find((d) => d.step_code === SIGNATURE_STEP);
  const step = type.steps.find((s) => s.code === SIGNATURE_STEP);
  if (!decision?.signature_url || decision.decision !== 'done') return undefined;
  const members = inExpediente(root, all);
  return {
    signed_by: decision.decided_by,
    signed_role: step?.role_name ?? '',
    signature_url: decision.signature_url,
    signed_at: decision.decided_at,
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
  const step = rootType?.steps.find((s) => s.code === SIGNATURE_STEP);
  const signed = root.decisions.find((d) => d.step_code === SIGNATURE_STEP);
  const canSign =
    Boolean(me && step) &&
    (me?.role_id === step?.role_id ||
      effectivePermissionsFor(me?.id ?? '').includes('tickets.decide_any'));

  return {
    ticket_id: root.id,
    ticket_code: root.code,
    closed: root.status_is_final,
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
    // La firma se registra en el propio acto de cerrar, así que no cuenta.
    ready: blockers.every((b) => b.kind === 'pending_step' && b.step_code === SIGNATURE_STEP),
    signer: {
      user_name: me?.full_name ?? '',
      role_name: me?.role_name ?? '',
      has_signature: Boolean(me?.signature_url),
      can_sign: canSign,
      step_code: step?.code,
      step_role_name: step?.role_name,
      step_signed: Boolean(signed?.decision === 'done' && signed.signature_url),
    },
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
