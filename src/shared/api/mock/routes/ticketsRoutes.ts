import { Attachment, Decision, Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import {
  archiveFileName,
  archiveInBlackbox,
  documentTypeFor,
  folderIdFor,
  signedLink,
} from '../blackbox';
import { currentIdempotencyKey } from '../requestContext';
import { ticketTypes, tickets } from '../ticketsDb';
import {
  MockResponse,
  adminState,
  effectivePermissionsFor,
  paginate,
  registerTypePermissions,
  unregisterTypePermissions,
} from './adminRoutes';
import { normalizeFields, normalizeStatuses, normalizeSteps, slug } from './ticketSchema';
import { currentAuditActor, diffValues, recordAudit } from '../auditDb';
import { routePassengerSearch } from '../passengers';
import { resolveMoney } from '../money';
import { computeTotals } from '../totals';
import {
  buildClosingStamp,
  closingBlockMessage,
  routeClosing,
  signatureProblemFor,
} from './closingRoutes';
import { extractFrom, extractFromAttachment, shouldExtract } from '../extraction';
import {
  applyRules,
  evaluateRules,
  missingAuthorization,
  ruleState,
  setTicketLookup,
} from '../rules';
import { buildOperationCode } from '../numbering';
import { periodLockedForPayload, periodLockedResponse } from '../reconciliationDb';
import {
  notifyCloseBlocked,
  notifyInacStatus,
  notifyOperationClosed,
  notifyReceiptAwaiting,
  notifyTicketCreated,
} from '../notifications';

/** La bitácora la lee una persona: los valores van en su nombre, no en clave. */
const DECISION_LABELS: Record<Decision['decision'], string> = {
  done: 'Cumplido',
  rejected: 'Rechazado',
  not_applicable: 'No aplica',
};

function decisionLabel(value?: Decision['decision']): string | undefined {
  return value ? DECISION_LABELS[value] : undefined;
}

/** Etiquetas del tipo, para que la bitácora no muestre claves técnicas. */
function fieldLabels(type: TicketType): Record<string, string> {
  return Object.fromEntries(type.fields.map((f) => [f.key, f.label]));
}

export const ticketState = {
  types: ticketTypes.map((t) => ({ ...t })),
  tickets: tickets.map((t) => ({ ...t })),
  sequence: 5,
};

setTicketLookup((id) => ticketState.tickets.find((t) => t.id === id));

let idCounter = 0;
/** Id único aunque dos altas caigan en el mismo milisegundo. */
function uniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function validation(detail: string, errors?: Record<string, string>): MockResponse {
  return { status: 422, data: { title: 'errors.validationTitle', detail, errors } };
}

function notFound(): MockResponse {
  return { status: 404, data: { title: 'errors.notFoundTitle' } };
}

/**
 * Un expediente en estado final es inmutable: ni datos, ni estado, ni
 * decisiones, ni soportes nuevos. Una bitácora corregible no prueba nada, y
 * un cierre firmado que se puede reabrir tampoco.
 */
function lockedResponse(ticket: Ticket, attempt = 'modificar'): MockResponse | undefined {
  // Un gasto de un período cerrado es inmutable aunque su estado no sea final.
  if (!ticket.status_is_final) return periodLockedResponse(ticket, typeOf(ticket.type_code), attempt);
  // Un intento rechazado también es un hecho que la bitácora debe poder probar.
  recordAudit({
    action: 'denied',
    entity: 'ticket',
    entity_id: ticket.id,
    entity_label: ticket.code,
    summary: `Intento de ${attempt} ${ticket.code}, que está cerrado`,
  });
  return {
    status: 409,
    data: {
      title: 'errors.conflictTitle',
      detail: `${ticket.code} está cerrado y no admite cambios.`,
    },
  };
}

function syncCounts() {
  ticketState.types.forEach((type) => {
    type.tickets_count = ticketState.tickets.filter((t) => t.type_code === type.code).length;
  });
  ticketState.tickets.forEach((ticket) => {
    ticket.children_count = ticketState.tickets.filter((t) => t.parent_id === ticket.id).length;
  });
}

function typeOf(code: string): TicketType | undefined {
  return ticketState.types.find((t) => t.code === code);
}

function applyStatus(ticket: Ticket, type: TicketType, statusCode: string): boolean {
  const status = type.statuses.find((s) => s.code === statusCode);
  if (!status) return false;
  ticket.status_code = status.code;
  ticket.status_name = status.name;
  ticket.status_color = status.color;
  ticket.status_is_final = status.is_final;
  ticket.closed_at = status.is_final ? new Date().toISOString() : undefined;
  return true;
}

function createType(body: Record<string, unknown>): MockResponse {
  const name = String(body.name ?? '').trim();
  if (name.length < 3)
    return validation('El nombre del tipo es obligatorio.', { name: 'errors.required' });

  const code = String(body.code ?? '').trim() || slug(name);
  if (ticketState.types.some((t) => t.code === code)) {
    return validation('Ya existe un tipo con ese código.', { name: 'ticketTypes.duplicated' });
  }

  const fields = normalizeFields(body.fields);
  const statuses = normalizeStatuses(body.statuses);
  const steps = normalizeSteps(body.steps, adminState.roles);
  if (fields.length === 0) return validation('Agrega al menos un campo al formulario.');
  if (statuses.length === 0) return validation('Agrega al menos un estado.');

  const role = adminState.roles.find((r) => r.id === String(body.default_role_id ?? ''));
  const created: TicketType = {
    id: uniqueId('tt'),
    code,
    name,
    description: body.description ? String(body.description) : undefined,
    is_root: body.is_root === true || body.is_root === 'true',
    child_type_codes: Array.isArray(body.child_type_codes)
      ? (body.child_type_codes as string[])
      : [],
    default_role_id: role?.id,
    default_role_name: role?.name,
    blocks_parent_close: body.blocks_parent_close === true || body.blocks_parent_close === 'true',
    relation_kinds: Array.isArray(body.relation_kinds)
      ? (body.relation_kinds as TicketType['relation_kinds'])
      : [],
    is_system: false,
    is_active: true,
    fields,
    statuses,
    steps,
    tickets_count: 0,
  };
  ticketState.types = [...ticketState.types, created];
  registerTypePermissions(created.code, created.name);
  return { status: 201, data: created };
}

function updateType(id: string, body: Record<string, unknown>): MockResponse {
  const type = ticketState.types.find((t) => t.id === id);
  if (!type) return notFound();

  if (body.name !== undefined) type.name = String(body.name);
  if (body.description !== undefined) type.description = String(body.description);
  if (body.is_root !== undefined) type.is_root = body.is_root === true || body.is_root === 'true';
  if (body.blocks_parent_close !== undefined) {
    type.blocks_parent_close =
      body.blocks_parent_close === true || body.blocks_parent_close === 'true';
  }
  if (Array.isArray(body.child_type_codes))
    type.child_type_codes = body.child_type_codes as string[];
  if (Array.isArray(body.relation_kinds)) {
    type.relation_kinds = body.relation_kinds as TicketType['relation_kinds'];
  }
  if (body.default_role_id !== undefined) {
    const role = adminState.roles.find((r) => r.id === String(body.default_role_id));
    type.default_role_id = role?.id;
    type.default_role_name = role?.name;
  }
  if (body.fields !== undefined) {
    const fields = normalizeFields(body.fields);
    if (fields.length === 0) return validation('El formulario debe tener al menos un campo.');
    type.fields = fields;
  }
  if (body.statuses !== undefined) {
    const statuses = normalizeStatuses(body.statuses);
    if (statuses.length === 0) return validation('El tipo debe tener al menos un estado.');
    type.statuses = statuses;
  }
  if (body.steps !== undefined) type.steps = normalizeSteps(body.steps, adminState.roles);
  if (body.is_active !== undefined) {
    const nextActive = body.is_active === true || body.is_active === 'true';
    if (!nextActive && type.is_system)
      return validation('Ese tipo es del sistema y no puede desactivarse.');
    type.is_active = nextActive;
  }
  return { status: 200, data: type };
}

function deleteType(id: string): MockResponse {
  const type = ticketState.types.find((t) => t.id === id);
  if (!type) return notFound();
  if (type.is_system) return validation('Ese tipo es del sistema y no puede eliminarse.');
  if (ticketState.tickets.some((t) => t.type_code === type.code)) {
    return validation('El tipo tiene tickets registrados. Desactívalo en lugar de eliminarlo.');
  }
  ticketState.types = ticketState.types.filter((t) => t.id !== id);
  unregisterTypePermissions(type.code);
  return { status: 204, data: null };
}

function highestSequence(): number {
  return ticketState.tickets.reduce((max, t) => {
    const n = Number(/^TK-(\d+)$/.exec(t.code)?.[1] ?? 0);
    return Math.max(max, n);
  }, 0);
}

function createTicket(body: Record<string, unknown>): MockResponse {
  const type = typeOf(String(body.type_code ?? ''));
  if (!type) return validation('El tipo de ticket no existe.', { type_code: 'errors.required' });
  if (!type.is_active) return validation('Ese tipo de ticket está desactivado.');

  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const missing = type.fields.filter(
    (f) => f.required && (payload[f.key] === undefined || payload[f.key] === ''),
  );
  if (missing.length > 0) {
    return validation(
      `Faltan campos obligatorios: ${missing.map((f) => f.label).join(', ')}.`,
      Object.fromEntries(missing.map((f) => [f.key, 'errors.required'])),
    );
  }

  const parent = ticketState.tickets.find((t) => t.id === String(body.parent_id ?? ''));
  const parentLocked = parent ? lockedResponse(parent, 'agregar trabajo a') : undefined;
  if (parentLocked) return parentLocked;

  const periodBlocked = periodLockedForPayload(
    type,
    payload,
    { id: parent?.id ?? 'new', label: parent?.code ?? type.name },
    'registrar un gasto en',
    new Date().toISOString().slice(0, 10),
  );
  if (periodBlocked) return periodBlocked;

  const valued = resolveMoney(type, payload, parent);
  if (valued.error) return validation(valued.error);

  const initial = type.statuses.find((s) => s.is_initial) ?? type.statuses[0]!;
  const role = adminState.roles.find(
    (r) => r.id === String(body.assigned_role_id ?? type.default_role_id ?? ''),
  );

  // El responsable puntual es opcional y debe ser un usuario activo real.
  const assignee = adminState.users.find(
    (u) => u.id === String(body.assigned_user_id ?? '') && u.is_active,
  );

  // El correlativo parte del mayor ya usado: los datos de ejemplo traen TK-0007
  // y un contador fijo repetiría códigos.
  ticketState.sequence = Math.max(ticketState.sequence, highestSequence()) + 1;
  const code = type.is_root
    ? (buildOperationCode(type, payload, ticketState.tickets) ??
      String(body.code ?? `OP-${String(ticketState.sequence).padStart(4, '0')}`))
    : `TK-${String(ticketState.sequence).padStart(4, '0')}`;
  const operationDate = payload.date ? new Date(String(payload.date)) : new Date();
  const operationYear = Number.isNaN(operationDate.getTime())
    ? new Date().getFullYear()
    : operationDate.getFullYear();
  const controlNumber = type.is_root
    ? `TVOA N°${String(ticketState.sequence).padStart(4, '0')}-${String(operationYear).slice(-2)}`
    : undefined;
  const createdPayload = controlNumber ? { ...payload, control_number: controlNumber } : payload;
  const created: Ticket = {
    id: uniqueId('tk'),
    // Los expedientes llevan la matrícula; el trabajo que cuelga de ellos usa
    // un correlativo simple, porque ya se lee en contexto del padre.
    code,
    control_number: controlNumber,
    type_code: type.code,
    type_name: type.name,
    type_is_root: type.is_root,
    title: String(body.title ?? type.name),
    status_code: initial.code,
    status_name: initial.name,
    status_color: initial.color,
    status_is_final: initial.is_final,
    parent_id: parent?.id,
    parent_code: parent?.code,
    assigned_role_id: role?.id,
    assigned_role_name: role?.name,
    assigned_user_id: assignee?.id,
    assigned_user_name: assignee?.full_name,
    created_by: String(body.created_by ?? 'Usuario actual'),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    due_at: body.due_at ? String(body.due_at) : undefined,
    payload: createdPayload,
    money: valued.money,
    relations: Array.isArray(body.relations) ? (body.relations as Ticket['relations']) : [],
    decisions: [],
    comments: [],
    files: [],
    attachments: 0,
    children_count: 0,
  };
  ticketState.tickets = [created, ...ticketState.tickets];
  syncCounts();
  ticketState.types.forEach((t) => registerTypePermissions(t.code, t.name));
  recordAudit({
    action: 'create',
    entity: 'ticket',
    entity_id: created.id,
    entity_label: created.code,
    summary: `Creó ${type.name} ${created.code}${parent ? ` en ${parent.code}` : ''}`,
    changes: diffValues({}, payload, fieldLabels(type)),
  });
  // Las reglas valen desde el alta: esperar a la siguiente edición dejaría pasar el primer aviso.
  created.rule_hits = applyRules(created, type);
  // El reporte vacío que abre el sistema no es una novedad: no se avisa a nadie.
  if (!body.silent) notifyTicketCreated(created, parent);
  // El piloto abre un reporte técnico en cada operación, haya novedad o no: el
  // sistema lo deja abierto y como bloqueo del cierre, en vez de confiar en que alguien se acuerde.
  if (type.is_root && type.child_type_codes.includes('technical_report') && typeOf('technical_report')) {
    createTicket({
      type_code: 'technical_report',
      title: `Reporte técnico · ${created.code}`,
      parent_id: created.id,
      assigned_role_id: 'r-3',
      silent: true,
      payload: { description: 'Pendiente del piloto', has_finding: false },
    });
  }
  return { status: 201, data: created };
}

/**
 * Visto bueno de la dirección sobre un gasto que una regla marcó. Lo da quien
 * tiene el permiso de decidir por cualquier rol; el servidor lo comprueba, no
 * la pantalla. Queda atado al importe: si el gasto cambia, hay que volver a pedirlo.
 */
function authorize(id: string, body: Record<string, unknown>): MockResponse {
  const ticket = ticketState.tickets.find((t) => t.id === id);
  if (!ticket) return notFound();
  const actor = currentAuditActor();
  if (!effectivePermissionsFor(actor.id).includes('tickets.decide_any')) {
    return { status: 403, data: { title: 'errors.forbiddenTitle' } };
  }
  const locked = lockedResponse(ticket, 'autorizar');
  if (locked) return locked;
  if (!(ticket.rule_hits ?? []).some((h) => h.action === 'require_authorization')) {
    return validation('Este registro no necesita autorización.');
  }
  ticket.authorization = {
    by: actor.name,
    role: actor.role,
    at: new Date().toISOString(),
    note: body.note ? String(body.note).slice(0, 500) : undefined,
    amount_base: ticket.money?.amount_base ?? 0,
  };
  ticket.updated_at = ticket.authorization.at;
  recordAudit({
    action: 'decision',
    entity: 'ticket',
    entity_id: ticket.id,
    entity_label: ticket.code,
    summary: `${actor.name} autorizó ${ticket.code} (${ticket.authorization.amount_base} ${ticket.money?.base_currency ?? ''})`,
  });
  return { status: 200, data: ticket };
}

function updateTicket(id: string, body: Record<string, unknown>): MockResponse {
  const ticket = ticketState.tickets.find((t) => t.id === id);
  if (!ticket) return notFound();
  const type = typeOf(ticket.type_code);
  if (!type) return notFound();
  const locked = lockedResponse(ticket, 'modificar');
  if (locked) return locked;
  // Mover la fecha de un gasto abierto hacia un mes cerrado también reescribe ese cierre.
  const moved = periodLockedForPayload(
    type,
    (body.payload ?? {}) as Record<string, unknown>,
    { id: ticket.id, label: ticket.code },
    'mover a un período cerrado',
  );
  if (moved) return moved;

  const before = { ...ticket.payload };
  const previousStatus = { code: ticket.status_code, name: ticket.status_name };

  if (body.status_code !== undefined) {
    const nextStatus = String(body.status_code);
    const target = type.statuses.find((s) => s.code === nextStatus);
    if (!target) return validation('Ese estado no existe para este tipo.');

    if (target.is_final) {
      // Los hijos sin resolver solo bloquean a un ticket raíz: es el único que
      // agrupa trabajo de otros.
      // Anular o rechazar no exige resolver el trabajo asociado: cerrar mal no
      // puede requerir fabricar aprobaciones.
      if (type.is_root && target.counts_as_committed) {
        const blockers = ticketState.tickets.filter(
          (child) =>
            child.parent_id === ticket.id &&
            !child.status_is_final &&
            (typeOf(child.type_code)?.blocks_parent_close ?? false),
        );
        if (blockers.length > 0) {
          notifyCloseBlocked(ticket, blockers);
          return validation(
            `No se puede cerrar: ${blockers.map((b) => b.code).join(', ')} sigue(n) sin resolver.`,
          );
        }
      }

      // Los pasos obligatorios se exigen en TODO tipo, no solo en la raíz. Se
      // exceptúan los cierres que no cuentan (rechazo, anulación): obligar a
      // completar el circuito para poder rechazar algo no tiene sentido.
      if (target.counts_as_committed && missingAuthorization(ticket)) {
        return validation(
          'Una regla exige la autorización de la dirección antes de dar por bueno este gasto.',
        );
      }
      if (target.counts_as_committed) {
        const pendingSteps = type.steps.filter(
          (s) => s.required && !ticket.decisions.some((d) => d.step_code === s.code),
        );
        if (pendingSteps.length > 0) {
          return validation(
            `Faltan pasos por registrar: ${pendingSteps.map((s) => s.name).join(', ')}.`,
          );
        }
      }
      // Cierre firmado de la operación: soportes completos y rúbrica de quien firma.
      if (type.is_root && target.counts_as_committed) {
        const blocked =
          closingBlockMessage(ticket, ticketState.tickets, typeOf, [
            'pending_step',
            'unresolved_child',
          ]) ?? signatureProblemFor(ticket, type);
        if (blocked) return validation(blocked);
      }
    }
    applyStatus(ticket, type, nextStatus);
    if (type.is_root && target.is_final && target.counts_as_committed && !ticket.closing) {
      ticket.closing = buildClosingStamp(ticket, type, ticketState.tickets, typeOf);
    }
    notifyOperationClosed(ticket, type);
    notifyInacStatus(ticket, type);
    recordAudit({
      action: 'status_change',
      entity: 'ticket',
      entity_id: ticket.id,
      entity_label: ticket.code,
      summary: `Cambió el estado de ${ticket.code}: ${previousStatus.name} → ${ticket.status_name}`,
      changes: [
        {
          field: 'status_code',
          label: 'Estado',
          from: previousStatus.name,
          to: ticket.status_name,
        },
      ],
    });
  }

  if (body.payload !== undefined) {
    ticket.payload = { ...ticket.payload, ...(body.payload as Record<string, unknown>) };

    // El importe se recalcula con la tasa vigente del padre y se vuelve a
    // congelar: editar el monto sin revalorizar dejaría el total desfasado.
    const parent = ticketState.tickets.find((t) => t.id === ticket.parent_id);
    const valued = resolveMoney(type, ticket.payload, parent, ticket.money);
    if (valued.error) {
      ticket.payload = before;
      return validation(valued.error);
    }
    ticket.money = valued.money;

    const changes = diffValues(before, ticket.payload, fieldLabels(type));
    if (changes.length > 0) {
      recordAudit({
        action: 'update',
        entity: 'ticket',
        entity_id: ticket.id,
        entity_label: ticket.code,
        summary: `Editó ${changes.length} campo(s) de ${ticket.code}`,
        changes,
      });
    }
  }
  if (body.assigned_role_id !== undefined) {
    const role = adminState.roles.find((r) => r.id === String(body.assigned_role_id));
    const fromRole = ticket.assigned_role_name;
    ticket.assigned_role_id = role?.id;
    ticket.assigned_role_name = role?.name;
    recordAudit({
      action: 'update',
      entity: 'ticket',
      entity_id: ticket.id,
      entity_label: ticket.code,
      summary: `Reasignó ${ticket.code} a ${role?.name ?? 'sin rol'}`,
      changes: [{ field: 'assigned_role', label: 'Responsable', from: fromRole, to: role?.name }],
    });
  }
  if (body.assigned_user_id !== undefined) {
    const user = adminState.users.find(
      (u) => u.id === String(body.assigned_user_id) && u.is_active,
    );
    ticket.assigned_user_id = user?.id;
    ticket.assigned_user_name = user?.full_name;
  }
  if (body.comment) {
    ticket.comments = [
      ...ticket.comments,
      {
        id: uniqueId('c'),
        author: String(body.comment_author ?? 'Usuario actual'),
        body: String(body.comment),
        created_at: new Date().toISOString(),
      },
    ];
    recordAudit({
      action: 'comment',
      entity: 'ticket',
      entity_id: ticket.id,
      entity_label: ticket.code,
      summary: `Comentó en ${ticket.code}: "${String(body.comment).slice(0, 80)}"`,
    });
  }
  ticket.rule_hits = applyRules(ticket, type);
  ticket.updated_at = new Date().toISOString();
  return { status: 200, data: ticket };
}

/**
 * Carga un archivo: va a Blackbox, que lo archiva en la carpeta del
 * expediente, y el ticket guarda solo la referencia. El original no viaja con
 * el ticket; se pide aparte con un enlace que vence.
 */
function addAttachment(id: string, body: Record<string, unknown>): MockResponse {
  const ticket = ticketState.tickets.find((t) => t.id === id);
  if (!ticket) return notFound();
  const type = typeOf(ticket.type_code);
  if (!type) return notFound();
  const locked = lockedResponse(ticket, 'adjuntar un archivo a');
  if (locked) return locked;

  const dataUrl = String(body.data_url ?? '');
  if (!dataUrl.startsWith('data:'))
    return validation('El archivo llegó vacío o con formato inválido.');

  // Todo el expediente comparte una carpeta: la de la operación raíz.
  const operationCode = ticket.parent_code ?? (type.is_root ? ticket.code : undefined);
  const documentType = documentTypeFor(type, body.field_key ? String(body.field_key) : undefined);
  const sequence = ticket.files.filter((f) => f.document_type === documentType).length + 1;
  const name = archiveFileName({
    ticketCode: ticket.code,
    documentType,
    sequence,
    originalName: String(body.name ?? 'archivo'),
  });
  const stored = archiveInBlackbox({
    folderId: folderIdFor(operationCode, ticket.created_at),
    filename: name,
    mime: String(body.mime ?? 'application/octet-stream'),
    dataUrl,
    documentType,
    idempotencyKey: currentIdempotencyKey(),
  });
  if (!stored.ok) {
    return {
      status: stored.status,
      data: { title: 'errors.validationTitle', detail: stored.detail, codigo: stored.codigo },
    };
  }

  const file: Attachment = {
    id: `at-${stored.doc.id}`,
    name: String(body.name ?? 'archivo'),
    mime: stored.doc.mime,
    size: Number(body.size ?? stored.doc.size),
    document_type: stored.doc.document_type,
    storage: {
      provider: 'blackbox',
      document_id: stored.doc.id,
      folder: stored.doc.folder,
      filename: stored.doc.filename,
    },
    uploaded_by: currentAuditActor().name,
    uploaded_at: stored.doc.created_at,
  };
  if (shouldExtract(type, file)) file.extraction = extractFromAttachment(type, file);

  ticket.files = [...ticket.files, file];
  notifyReceiptAwaiting(ticket, file);
  ticket.attachments = ticket.files.length;
  ticket.rule_hits = applyRules(ticket, type);
  ticket.updated_at = file.uploaded_at;

  recordAudit({
    action: 'attach',
    entity: 'ticket',
    entity_id: ticket.id,
    entity_label: ticket.code,
    summary: `Adjuntó "${file.name}" a ${ticket.code}`,
    changes: file.extraction
      ? [
          {
            field: 'extraction',
            label: 'Lectura automática',
            from: null,
            to: file.extraction.status === 'unreadable' ? 'ilegible' : 'datos propuestos',
          },
        ]
      : [],
  });
  return { status: 201, data: ticket };
}

/**
 * Confirma la lectura de un comprobante. El payload del ticket se actualiza
 * con lo aprobado: hasta que alguien valida, lo leído es solo una propuesta.
 */
function validateAttachment(
  ticketId: string,
  fileId: string,
  body: Record<string, unknown>,
): MockResponse {
  const ticket = ticketState.tickets.find((t) => t.id === ticketId);
  if (!ticket) return notFound();
  const type = typeOf(ticket.type_code);
  const file = ticket.files.find((f) => f.id === fileId);
  if (!type || !file?.extraction) return notFound();
  const periodClosed = periodLockedResponse(ticket, type, 'validar un comprobante de');
  if (periodClosed) return periodClosed;

  const raw = body.fields;
  const approved: { key: string; value: string | number }[] =
    typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  const corrections = approved
    .map((a) => {
      const original = file.extraction?.fields.find((f) => f.key === a.key);
      if (!original || String(original.value) === String(a.value)) return null;
      return { key: a.key, from: original.value, to: a.value };
    })
    .filter(Boolean) as { key: string; from: string | number; to: string | number }[];

  // Un dato de baja confianza se revisa a propósito: o lo corrigió la persona
  // o dejó constancia de haberlo mirado. Aprobar a ciegas lo que la máquina dudó
  // es justo lo que esta consola existe para evitar.
  const rawConfirmed = body.confirmed;
  const confirmed: string[] =
    typeof rawConfirmed === 'string'
      ? JSON.parse(rawConfirmed)
      : Array.isArray(rawConfirmed)
        ? (rawConfirmed as string[])
        : [];
  const unreviewed = file.extraction.fields.filter(
    (f) =>
      f.confidence === 'low' &&
      !confirmed.includes(f.key) &&
      String(approved.find((x) => x.key === f.key)?.value ?? f.value) === String(f.value),
  );
  if (unreviewed.length > 0) {
    return validation(
      `Revisa antes de aprobar: ${unreviewed.map((f) => f.label).join(', ')} (confianza baja).`,
      Object.fromEntries(unreviewed.map((f) => [f.key, 'errors.required'])),
    );
  }

  const actor = currentAuditActor();
  file.extraction = {
    ...file.extraction,
    status: 'validated',
    fields: file.extraction.fields.map((f) => {
      const a = approved.find((x) => x.key === f.key);
      return a ? { ...f, value: a.value } : f;
    }),
    corrections,
    validated_by: actor.name,
    validated_at: new Date().toISOString(),
  };

  const before = { ...ticket.payload };
  approved.forEach((a) => {
    ticket.payload[a.key] = a.value;
  });

  const parent = ticketState.tickets.find((t) => t.id === ticket.parent_id);
  const valued = resolveMoney(type, ticket.payload, parent, ticket.money);
  if (valued.error) {
    ticket.payload = before;
    return validation(valued.error);
  }
  ticket.money = valued.money;
  ticket.rule_hits = applyRules(ticket, type);
  ticket.updated_at = new Date().toISOString();

  recordAudit({
    action: 'update',
    entity: 'ticket',
    entity_id: ticket.id,
    entity_label: ticket.code,
    summary:
      corrections.length > 0
        ? `Validó el comprobante de ${ticket.code} corrigiendo ${corrections.length} campo(s)`
        : `Validó el comprobante de ${ticket.code} sin correcciones`,
    changes: corrections.map((c) => ({
      field: c.key,
      label: fieldLabels(type)[c.key] ?? c.key,
      from: c.from,
      to: c.to,
    })),
  });
  return { status: 200, data: ticket };
}

function decide(id: string, body: Record<string, unknown>): MockResponse {
  const ticket = ticketState.tickets.find((t) => t.id === id);
  if (!ticket) return notFound();
  const type = typeOf(ticket.type_code);
  const step = type?.steps.find((s) => s.code === String(body.step_code ?? ''));
  if (!type || !step) return validation('Ese paso no existe para este tipo.');
  const locked = lockedResponse(ticket, 'registrar una decisión en');
  if (locked) return locked;

  // Solo se estampa al cumplir: un rechazo no lleva rúbrica.
  const value = (body.decision as Decision['decision']) ?? 'done';
  const signer = adminState.users.find((u) => u.id === currentAuditActor().id);

  const decision: Decision = {
    id: uniqueId('d'),
    step_code: step.code,
    step_name: step.name,
    decision: value,
    observation: body.observation ? String(body.observation) : undefined,
    decided_by: String(body.decided_by ?? signer?.full_name ?? 'Usuario actual'),
    decided_at: new Date().toISOString(),
    signature_url: value === 'done' ? signer?.signature_url : undefined,
  };
  // Registrar de nuevo un paso reemplaza la decisión en el ticket; la
  // anterior sobrevive únicamente en la bitácora, por eso se guarda el diff.
  const previous = ticket.decisions.find((d) => d.step_code === step.code);
  ticket.decisions = [...ticket.decisions.filter((d) => d.step_code !== step.code), decision];
  ticket.updated_at = decision.decided_at;

  recordAudit({
    action: 'decision',
    entity: 'ticket',
    entity_id: ticket.id,
    entity_label: ticket.code,
    summary: previous
      ? `Rectificó el paso "${step.name}" de ${ticket.code}`
      : `Registró el paso "${step.name}" de ${ticket.code}`,
    changes: [
      {
        field: 'decision',
        label: step.name,
        from: decisionLabel(previous?.decision),
        to: decisionLabel(decision.decision),
      },
      ...(decision.observation || previous?.observation
        ? [
            {
              field: 'observation',
              label: 'Observación',
              from: previous?.observation,
              to: decision.observation,
            },
          ]
        : []),
    ],
  });

  const progressStatus = type.statuses.find((s) => !s.is_initial && !s.is_final);
  if (
    progressStatus &&
    ticket.status_code === (type.statuses.find((s) => s.is_initial)?.code ?? '')
  ) {
    applyStatus(ticket, type, progressStatus.code);
  }
  return { status: 200, data: ticket };
}

/**
 * Criterio único de filtrado. La lista y los totales lo comparten a propósito:
 * si divergieran, el total mostrado no cuadraría con las filas visibles.
 */
function filterTickets(query: URLSearchParams): Ticket[] {
  const q = (query.get('q') ?? '').toLowerCase();
  const status = query.get('status_code');
  const typeCode = query.get('type_code');
  const parentId = query.get('parent_id');
  const roleId = query.get('assigned_role_id');
  // `mine=true` es el contrato real (el servidor sabe quién pregunta); los dos
  // parámetros explícitos se conservan para los tests del simulador.
  const caller = adminState.users.find((u) => u.id === currentAuditActor().id);
  const mineAsked = query.get('mine') === 'true' && Boolean(caller);
  const mineUser = mineAsked ? (caller?.id ?? null) : query.get('mine_user_id');
  const mineRole = mineAsked ? (caller?.role_id ?? null) : query.get('mine_role_id');
  const isRoot = query.get('is_root');
  const openParam = query.get('open');
  const from = query.get('from');
  const to = query.get('to');
  const aircraft = query.get('aircraft');

  let items = ticketState.tickets;
  if (q) {
    items = items.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.parent_code ?? '').toLowerCase().includes(q),
    );
  }
  if (status) items = items.filter((t) => t.status_code === status);
  if (typeCode) items = items.filter((t) => t.type_code === typeCode);
  if (parentId) items = items.filter((t) => t.parent_id === parentId);
  if (roleId) items = items.filter((t) => t.assigned_role_id === roleId);
  // Un responsable puntual manda sobre el rol: si hay uno, el ticket es suyo
  // y no de todos los que comparten el rol.
  if (mineUser || mineRole) {
    items = items.filter((t) =>
      t.assigned_user_id
        ? t.assigned_user_id === mineUser
        : Boolean(mineRole) && t.assigned_role_id === mineRole,
    );
  }
  if (isRoot === 'true') items = items.filter((t) => t.type_is_root);
  if (isRoot === 'false') items = items.filter((t) => !t.type_is_root);
  if (openParam === 'true') items = items.filter((t) => !t.status_is_final);
  if (openParam === 'false') items = items.filter((t) => t.status_is_final);
  if (aircraft) {
    items = items.filter((t) =>
      t.relations.some((r) => r.kind === 'aircraft' && r.code === aircraft),
    );
  }
  if (from || to) items = items.filter((t) => withinDates(t, from, to));
  return items;
}

/**
 * Corta por la fecha contable del tipo si la definió el administrador; si no,
 * por la fecha de creación. Un gasto cargado tarde debe caer en el mes en que
 * ocurrió, no en el mes en que alguien lo tipeó.
 */
function withinDates(ticket: Ticket, from: string | null, to: string | null): boolean {
  const type = typeOf(ticket.type_code);
  const dateField = type?.fields.find((f) => f.role === 'accounting_date');
  // `??` no alcanza: el formulario envía cadena vacía cuando el campo quedó
  // sin llenar, y sin este chequeo el gasto se caía del reporte en silencio.
  const raw = dateField ? ticket.payload[dateField.key] : undefined;
  const hasDate = raw !== undefined && raw !== null && raw !== '';
  const value = String(hasDate ? raw : ticket.created_at).slice(0, 10);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function routeTickets(
  method: string,
  path: string,
  query: URLSearchParams,
  body: Record<string, unknown>,
): MockResponse | null {
  if (method === 'get' && path === '/ticket-types/') {
    const onlyActive = query.get('is_active') === 'true';
    const root = query.get('is_root');
    let items = ticketState.types;
    if (onlyActive) items = items.filter((t) => t.is_active);
    if (root === 'true') items = items.filter((t) => t.is_root);
    if (root === 'false') items = items.filter((t) => !t.is_root);
    return { status: 200, data: items };
  }
  if (method === 'post' && path === '/ticket-types/') return createType(body);

  const typeDetail = /^\/ticket-types\/([^/]+)\/$/.exec(path);
  if (typeDetail) {
    const id = typeDetail[1] ?? '';
    if (method === 'get') {
      const type = ticketState.types.find((t) => t.id === id);
      return type ? { status: 200, data: type } : notFound();
    }
    if (method === 'patch' || method === 'put') return updateType(id, body);
    if (method === 'delete') return deleteType(id);
  }

  if (method === 'get' && path === '/tickets/') {
    return paginate(filterTickets(query), query);
  }
  if (method === 'get' && path === '/tickets/totals/') {
    return { status: 200, data: computeTotals(filterTickets(query), typeOf) };
  }
  if (method === 'post' && path === '/tickets/') return createTicket(body);

  const closing = routeClosing(method, path, ticketState.tickets, typeOf);
  if (closing) return closing;

  const decisionPath = /^\/tickets\/([^/]+)\/decisions\/$/.exec(path);
  if (method === 'post' && decisionPath) return decide(decisionPath[1] ?? '', body);

  // Quién consulta sale del token (el actor de la petición), no del cuerpo.
  const actorId = currentAuditActor().id;
  const knownCaller = adminState.users.some((u) => u.id === actorId);
  const paxSearch = routePassengerSearch(
    method,
    path,
    query,
    ticketState.tickets,
    ticketState.types.filter((t) => t.is_root).map((t) => t.code),
    knownCaller ? effectivePermissionsFor(actorId) : null,
  );
  if (paxSearch) return paxSearch;

  const passengerPath = /^\/tickets\/([^/]+)\/passengers\/$/.exec(path);
  if (passengerPath) {
    const ticket = ticketState.tickets.find((t) => t.id === passengerPath[1]);
    if (!ticket) return notFound();
    if (method === 'get') return { status: 200, data: ticket.passengers ?? [] };
    // PUT es el verbo del contrato real (reemplazo completo); POST se conserva por compatibilidad.
    if (method === 'post' || method === 'put') {
      const raw = body.passengers;
      const list = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Ticket['passengers'];
      const before = ticket.passengers?.length ?? 0;
      // El pasaporte solo puede ser un soporte de ESTE expediente: si no, un
      // cliente podría colgar el archivo de otro expediente en su manifiesto.
      const ownFiles = new Set(ticket.files.map((f) => f.id));
      ticket.passengers = (list ?? []).map((x, i) => ({
        ...x,
        id: x.id || `pax-${i + 1}`,
        passport_file_id:
          x.passport_file_id && ownFiles.has(x.passport_file_id) ? x.passport_file_id : undefined,
      }));
      ticket.updated_at = new Date().toISOString();
      recordAudit({
        action: 'update',
        entity: 'ticket',
        entity_id: ticket.id,
        entity_label: ticket.code,
        summary: `Actualizó el manifiesto de ${ticket.code}`,
        changes: [
          { field: 'passengers', label: 'Pasajeros', from: before, to: ticket.passengers.length },
        ],
      });
      return { status: 200, data: ticket.passengers };
    }
  }

  const authorizePath = /^\/tickets\/([^/]+)\/authorize\/$/.exec(path);
  if (method === 'post' && authorizePath) return authorize(authorizePath[1] ?? '', body);

  // Lectura previa al alta: propone el renglón sin guardar nada.
  if (method === 'post' && path === '/attachments/extract/') {
    const type = typeOf(String(body.type_code ?? ''));
    if (!type || !shouldExtract(type, { mime: String(body.mime ?? '') } as Attachment)) {
      return validation('Este tipo de registro no lee comprobantes.');
    }
    return {
      status: 200,
      data: extractFrom(type, String(body.name ?? ''), Number(body.size ?? 0)),
    };
  }

  const attachPath = /^\/tickets\/([^/]+)\/attachments\/$/.exec(path);
  if (method === 'post' && attachPath) return addAttachment(attachPath[1] ?? '', body);

  const downloadPath = /^\/tickets\/([^/]+)\/attachments\/([^/]+)\/download\/$/.exec(path);
  if (method === 'get' && downloadPath) {
    const owner = ticketState.tickets.find((t) => t.id === downloadPath[1]);
    const file = owner?.files.find((f) => f.id === downloadPath[2]);
    const link = file ? signedLink(file.storage.document_id) : undefined;
    return link ? { status: 200, data: link } : notFound();
  }

  const validatePath = /^\/tickets\/([^/]+)\/attachments\/([^/]+)\/validate\/$/.exec(path);
  if (method === 'post' && validatePath) {
    return validateAttachment(validatePath[1] ?? '', validatePath[2] ?? '', body);
  }

  // Cola de validación: comprobantes leídos que todavía nadie confirmó.
  if (method === 'get' && path === '/attachments/pending/') {
    const pending = ticketState.tickets.flatMap((t) =>
      t.files
        .filter((f) => f.extraction?.status === 'extracted')
        .map((f) => ({
          ticket_id: t.id,
          ticket_code: t.code,
          ticket_title: t.title,
          type_name: t.type_name,
          parent_code: t.parent_code,
          file: f,
        })),
    );
    // Primero lo que una persona tiene que mirar con más cuidado: baja
    // confianza, luego los montos grandes. Lo fácil no debe tapar lo dudoso.
    const weight = (e: (typeof pending)[number]) =>
      e.file.extraction?.fields.some((f) => f.confidence === 'low') ? 1 : 0;
    const amount = (e: (typeof pending)[number]) =>
      ticketState.tickets.find((t) => t.id === e.ticket_id)?.money?.amount_base ?? 0;
    pending.sort((a, b) => weight(b) - weight(a) || amount(b) - amount(a));
    return paginate(pending, query);
  }

  if (method === 'get' && path === '/rules/') return { status: 200, data: ruleState.rules };
  if (method === 'post' && path === '/rules/') {
    const rule = {
      id: uniqueId('r'),
      name: String(body.name ?? ''),
      type_code: String(body.type_code ?? ''),
      field: String(body.field ?? 'amount_base'),
      operator: String(body.operator ?? 'gt'),
      value: body.value as number | string | undefined,
      action: String(body.action ?? 'warn'),
      message: String(body.message ?? ''),
      route_limits: (body.route_limits as Record<string, number> | undefined) ?? undefined,
      is_active: true,
    } as (typeof ruleState.rules)[number];
    ruleState.rules = [...ruleState.rules, rule];
    recordAudit({
      action: 'create',
      entity: 'ticket_type',
      entity_id: rule.id,
      entity_label: rule.name,
      summary: `Creó la regla "${rule.name}"`,
    });
    return { status: 201, data: rule };
  }
  const rulePath = /^\/rules\/([^/]+)\/$/.exec(path);
  if (rulePath) {
    const rule = ruleState.rules.find((r) => r.id === rulePath[1]);
    if (!rule) return notFound();
    if (method === 'patch') {
      const before = rule.is_active;
      Object.assign(rule, body);
      if (before !== rule.is_active) {
        recordAudit({
          action: 'update',
          entity: 'ticket_type',
          entity_id: rule.id,
          entity_label: rule.name,
          summary: `${rule.is_active ? 'Activó' : 'Desactivó'} la regla "${rule.name}"`,
          changes: [{ field: 'is_active', label: 'Activa', from: before, to: rule.is_active }],
        });
      }
      return { status: 200, data: rule };
    }
    if (method === 'delete') {
      ruleState.rules = ruleState.rules.filter((r) => r.id !== rule.id);
      return { status: 204, data: null };
    }
  }

  const ticketDetail = /^\/tickets\/([^/]+)\/$/.exec(path);
  if (ticketDetail) {
    const id = ticketDetail[1] ?? '';
    if (method === 'get') {
      const ticket = ticketState.tickets.find((t) => t.id === id);
      return ticket ? { status: 200, data: ticket } : notFound();
    }
    if (method === 'patch' || method === 'put') return updateTicket(id, body);
  }

  return null;
}

syncCounts();
ticketState.types.forEach((type) => registerTypePermissions(type.code, type.name));

// Las semillas traen payload pero no importe: se valorizan una vez al cargar,
// igual que lo haría una migración sobre datos existentes.
ticketState.tickets.forEach((ticket) => {
  const type = typeOf(ticket.type_code);
  if (!type) return;
  const parent = ticketState.tickets.find((t) => t.id === ticket.parent_id);
  const valued = resolveMoney(type, ticket.payload, parent);
  if (valued.money) ticket.money = valued.money;
  // Las reglas valen para todo lo que ya está cargado, no solo para lo que se
  // edite de ahora en más: un gasto viejo sin comprobante también debe avisar.
  ticket.rule_hits = evaluateRules(ticket, type);
});
