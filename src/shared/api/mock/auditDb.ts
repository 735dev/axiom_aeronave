import { AuditChange, AuditEvent } from '@/features/audit/types/audit.types';

interface Actor {
  id: string;
  name: string;
  role: string;
}

const SYSTEM: Actor = { id: 'system', name: 'Sistema', role: 'Automático' };

/**
 * Actor de la petición en curso. El mock atiende una petición a la vez, así
 * que alcanza con una variable de módulo; en el backend esto es el contexto
 * de la petición y sale del token, nunca del cuerpo enviado por el cliente.
 */
let currentActor: Actor = SYSTEM;

export function setAuditActor(actor: Actor | null) {
  currentActor = actor ?? SYSTEM;
}

/** Quién está ejecutando la petición en curso. */
export function currentAuditActor(): Actor {
  return currentActor;
}

export const auditState: { events: AuditEvent[] } = { events: [] };

let seq = 0;

interface RecordInput {
  action: AuditEvent['action'];
  entity: AuditEvent['entity'];
  entity_id: string;
  entity_label: string;
  summary: string;
  changes?: AuditChange[];
  /** Para el registro de acceso, donde aún no hay sesión establecida. */
  actor?: Actor;
}

/**
 * Asienta un hecho. Congela nombre y rol del actor: si mañana renombran al
 * usuario o le cambian el rol, la bitácora sigue diciendo quién era entonces.
 */
export function recordAudit(input: RecordInput): AuditEvent {
  const actor = input.actor ?? currentActor;
  seq += 1;
  const event: AuditEvent = {
    id: `ev-${seq}`,
    at: new Date().toISOString(),
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: input.action,
    entity: input.entity,
    entity_id: input.entity_id,
    entity_label: input.entity_label,
    summary: input.summary,
    changes: input.changes ?? [],
    user_agent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
  };
  auditState.events = [event, ...auditState.events];
  return event;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Compara dos objetos y devuelve solo lo que cambió de verdad. Un campo que
 * pasa de `undefined` a `''` no es un cambio y no debe ensuciar la bitácora.
 */
export function diffValues(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string> = {},
): AuditChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChange[] = [];
  keys.forEach((key) => {
    const from = before[key];
    const to = after[key];
    if (isEmpty(from) && isEmpty(to)) return;
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    changes.push({ field: key, label: labels[key] ?? key, from, to });
  });
  return changes;
}
