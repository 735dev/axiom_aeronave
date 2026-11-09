import { ApiResult } from '@/shared/api/types';
import { OfflineQueue, SubmitOutcome, submitOrQueue } from '@/shared/offline/queue';
import { AttachmentInput, CreateTicketPayload, UpdateTicketPayload } from '../api/ticketsApi';
import { createWithAttachments } from '../api/createWithAttachments';
import { updateWithAttachments } from '../api/updateWithAttachments';
import { Ticket, TicketType } from '../types/ticket.types';

/** Tipo de ticket que recibe la bitácora: la novedad de vuelo es un reporte técnico. */
export const QUICK_LOG_TYPE = 'technical_report';
export const MAX_NOTE = 280;
/** El tipo exige descripción; sin novedad se deja constancia explícita, no vacío. */
export const NO_FINDING_TEXT = 'Sin novedad';

/** Hallazgos frecuentes. El texto sale de i18n (`quicklog.chips.<id>`), no de un catálogo. */
export const FINDING_CHIPS = [
  'engine',
  'landing_gear',
  'avionics',
  'hydraulic',
  'electric',
  'tires',
  'fuel',
  'weather',
  'bird',
] as const;
export type FindingChip = (typeof FINDING_CHIPS)[number];

export interface QuickLogForm {
  operationId: string;
  /** HH:MM */
  departure: string;
  /** HH:MM */
  arrival: string;
  /** La llegada cae al día siguiente (vuelo nocturno). */
  nextDay: boolean;
  hasFinding: boolean;
  note: string;
}

export const EMPTY_FORM: QuickLogForm = {
  operationId: '',
  departure: '',
  arrival: '',
  nextDay: false,
  hasFinding: false,
  note: '',
};

export type QuickLogErrors = Partial<
  Record<'operation' | 'departure' | 'arrival' | 'note', string>
>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Hora local del teléfono como HH:MM, para el botón "Ahora". */
export function nowAsTime(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Devuelve claves de i18n por campo; vacío = válido. */
export function validateQuickLog(form: QuickLogForm): QuickLogErrors {
  const errors: QuickLogErrors = {};
  if (!form.operationId) errors.operation = 'quicklog.errors.operation';

  if (!form.departure) errors.departure = 'quicklog.errors.departureRequired';
  else if (!TIME.test(form.departure)) errors.departure = 'quicklog.errors.timeInvalid';

  if (!form.arrival) errors.arrival = 'quicklog.errors.arrivalRequired';
  else if (!TIME.test(form.arrival)) errors.arrival = 'quicklog.errors.timeInvalid';

  if (!errors.departure && !errors.arrival) {
    const dep = toMinutes(form.departure);
    const arr = toMinutes(form.arrival);
    // Llegar antes de salir solo es posible pasando la medianoche, y eso lo
    // confirma la persona: asumirlo escondería un error de tipeo (08:00 / 07:00).
    if (arr === dep && !form.nextDay) errors.arrival = 'quicklog.errors.sameTime';
    else if (arr < dep && !form.nextDay) errors.arrival = 'quicklog.errors.arrivalBeforeDeparture';
  }

  const note = form.note.trim();
  if (form.hasFinding && !note) errors.note = 'quicklog.errors.noteRequired';
  else if (form.note.length > MAX_NOTE) errors.note = 'quicklog.errors.noteTooLong';
  return errors;
}

/** Agrega el texto de un hallazgo a la nota sin pasar de MAX_NOTE. `null` = no cabe. */
export function appendFinding(note: string, label: string): string | null {
  const current = note.trim();
  if (current.toLowerCase().includes(label.toLowerCase())) return note;
  const next = current ? `${current}. ${label}` : label;
  return next.length > MAX_NOTE ? null : next;
}

/** Operación de arranque: la abierta de la aeronave del usuario; si no, la primera abierta. */
export function pickDefaultOperation(
  operations: Ticket[],
  aircraftId?: string,
): Ticket | undefined {
  const open = operations.filter((o) => !o.status_is_final);
  const mine = aircraftId
    ? open.find((o) => o.relations.some((r) => r.kind === 'aircraft' && r.code === aircraftId))
    : undefined;
  return mine ?? open[0];
}

export function buildQuickLogInput(
  form: QuickLogForm,
  type: Pick<TicketType, 'name' | 'default_role_id'>,
  parent: Pick<Ticket, 'id' | 'code'>,
): CreateTicketPayload {
  return {
    type_code: QUICK_LOG_TYPE,
    title: `${type.name} · ${parent.code}`,
    parent_id: parent.id,
    assigned_role_id: type.default_role_id,
    payload: quickLogPayload(form),
  };
}

/** Los datos de la bitácora, igual para crear el reporte o completar el existente. */
export function quickLogPayload(form: QuickLogForm): Record<string, unknown> {
  return {
    actual_departure: form.departure,
    actual_arrival: form.arrival,
    has_finding: form.hasFinding,
    description: form.hasFinding ? form.note.trim() : NO_FINDING_TEXT,
    ...(form.nextDay ? { arrival_next_day: true } : {}),
  };
}

/**
 * Cada operación nace con su reporte técnico abierto: la bitácora lo completa.
 * Si hay varios abiertos se toma el más antiguo, el que nació con la operación.
 */
export function findOpenReport(children: Ticket[]): Ticket | undefined {
  return children
    .filter((c) => c.type_code === QUICK_LOG_TYPE && !c.status_is_final)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export interface QuickLogDeps {
  queue: OfflineQueue;
  userId: string;
  /** Texto de la cola de pendientes. */
  label: string;
  /** Reporte técnico abierto de la operación: si existe se completa, no se crea otro. */
  existing?: Pick<Ticket, 'id'>;
  send?: (
    input: CreateTicketPayload,
    files: AttachmentInput[],
    key: string,
  ) => Promise<ApiResult<Ticket>>;
  sendUpdate?: (
    ticketId: string,
    input: UpdateTicketPayload,
    files: AttachmentInput[],
    key: string,
  ) => Promise<ApiResult<Ticket>>;
  isOnline?: () => boolean;
}

/**
 * Guarda la bitácora en el reporte técnico de la operación.
 *
 * Completa el reporte abierto si existe (PATCH) y solo crea uno nuevo si no
 * hay ninguno. Misma ruta que `NewTicketDialog` para trabajo no raíz: se
 * intenta y, sin señal, queda en la cola con la MISMA clave de idempotencia,
 * de modo que el reintento no duplica el reporte ni sus fotos.
 */
export function submitQuickLog(
  deps: QuickLogDeps,
  input: CreateTicketPayload,
  files: AttachmentInput[],
  key: string,
): Promise<SubmitOutcome<Ticket>> {
  const base = { key, userId: deps.userId, label: deps.label };
  if (deps.existing) {
    const ticketId = deps.existing.id;
    // Sin novedad no hay nada que responder: el reporte se resuelve solo, y deja
    // de bloquear el cierre de la operación.
    const noFinding = input.payload?.has_finding === false;
    const patch: UpdateTicketPayload = {
      payload: input.payload,
      ...(noFinding ? { status_code: 'no_findings' } : {}),
    };
    const sendUpdate = deps.sendUpdate ?? updateWithAttachments;
    return submitOrQueue(
      deps.queue,
      {
        ...base,
        kind: 'update_ticket',
        request: { ticketId, body: patch, attachments: files },
      },
      () => sendUpdate(ticketId, patch, files, key),
      deps.isOnline,
    );
  }
  const send = deps.send ?? createWithAttachments;
  return submitOrQueue(
    deps.queue,
    { ...base, kind: 'create_ticket', request: { body: input, attachments: files } },
    () => send(input, files, key),
    deps.isOnline,
  );
}
