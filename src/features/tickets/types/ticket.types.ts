import { CatalogKey } from '@/features/catalogs/types/catalog.types';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'money'
  | 'select'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'checkbox_group'
  | 'file';

export type FieldWidth = 'full' | 'half';

/**
 * Qué SIGNIFICA el campo para el sistema, independiente de cómo se llame.
 * Sin esto, un total tendría que adivinar por el nombre de la clave y se
 * rompería en silencio en cuanto alguien cree un tipo con otra nomenclatura.
 */
export type FieldRole =
  | 'amount'
  | 'currency'
  | 'quantity'
  | 'unit'
  | 'item'
  | 'accounting_date'
  /** Proveedor que emitió el comprobante: se prellena desde la lectura. */
  | 'supplier'
  /** Tasa Bs/USD de la operación: el sistema propone la oficial del día. */
  | 'exchange_rate'
  /** Matrícula que da nombre al expediente: `YV2323-001-26`. */
  | 'aircraft'
  /** Marca y modelo de la aeronave: se proponen al elegir la matrícula. */
  | 'aircraft_brand'
  | 'aircraft_model';

export interface FieldOption {
  value: string;
  label: string;
}

/** Campo del formulario de un tipo de ticket. Lo define el administrador. */
export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  width: FieldWidth;
  help?: string;
  options?: FieldOption[];
  catalog?: CatalogKey;
  /** Clave del campo padre: sus opciones son las del catálogo cuyo `extra` es el valor del padre. */
  depends_on?: string;
  /** Significado del campo para totales y analítica. Vacío = solo dato. */
  role?: FieldRole;
  /** Sin este permiso el campo no se muestra. Vacío = visible para todos. */
  view_permission?: string;
  /** Sin este permiso el campo se muestra en solo lectura. */
  edit_permission?: string;
  /** Campo generado por el sistema: visible, pero no editable. */
  read_only?: boolean;
  sort_order: number;
}

/** Estado configurable. Cada tipo define los suyos. */
export interface StatusDef {
  id: string;
  code: string;
  name: string;
  color: 'default' | 'info' | 'warning' | 'danger' | 'success';
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  /**
   * Si los montos de este ticket entran en los totales. `is_final` no sirve
   * para esto: "rechazado" también es final y no debe sumar.
   */
  counts_as_committed: boolean;
}

/** Paso del flujo. Tiene responsable y deja registro de quién decidió. */
export interface StepDef {
  id: string;
  code: string;
  name: string;
  role_id?: string;
  role_name?: string;
  /** Área operativa responsable cuando no coincide con un rol de acceso. */
  responsible_area?: string;
  required: boolean;
  /** Quien decide este paso estampa su firma; el cierre exige todas las firmas. */
  requires_signature?: boolean;
  sort_order: number;
}

export type DecisionValue = 'done' | 'rejected' | 'not_applicable';

export interface Decision {
  id: string;
  step_code: string;
  step_name: string;
  decision: DecisionValue;
  observation?: string;
  decided_by: string;
  decided_at: string;
  /**
   * Rúbrica del firmante, copiada al momento de decidir. Se congela igual que
   * el resto de la evidencia: si el usuario cambia su firma después, lo que ya
   * firmó debe seguir mostrando la que usó entonces.
   */
  signature_url?: string;
  /** El servidor solo informa que firmó; la imagen sale únicamente del resumen de cierre. */
  signed?: boolean;
}

/** Nivel de certeza de un dato leído automáticamente del comprobante. */
export type Confidence = 'high' | 'low';

/** Un campo extraído del comprobante, con lo que el sistema cree que dice. */
export interface ExtractedField {
  key: string;
  label: string;
  value: string | number;
  confidence: Confidence;
}

export type ExtractionStatus = 'pending' | 'extracted' | 'validated' | 'unreadable';

/**
 * Lectura automática de un comprobante.
 *
 * `validated_by` es lo que separa acelerar el trabajo de automatizar un error:
 * ningún dato leído entra a la contabilidad sin que una persona responda por él.
 */
export interface Extraction {
  status: ExtractionStatus;
  fields: ExtractedField[];
  /** Campos que la persona corrigió al validar, con su valor anterior. */
  corrections: { key: string; from: string | number; to: string | number }[];
  validated_by?: string;
  validated_at?: string;
}

export interface AttachmentStorage {
  provider: 'blackbox';
  document_id: string;
  /** Carpeta del expediente, `Maestro - {operación}`. */
  folder: string;
  /** Nombre con el que quedó en la carpeta, ordenado por ticket y tipo. */
  filename: string;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  /** Tamaño en bytes del archivo original, antes de reducirlo. */
  size: number;
  /** Categoría del soporte en Blackbox: comprobante, manifiesto, pasaporte… */
  document_type: string;
  /** Dónde vive el original. El contenido no viaja con el ticket: se pide aparte. */
  storage: AttachmentStorage;
  uploaded_by: string;
  uploaded_at: string;
  /** Presente solo en imágenes de comprobante sobre tipos con importe. */
  extraction?: Extraction;
}

export type RelationKind = 'aircraft' | 'service' | 'airport' | 'inventory' | 'ticket';

export interface Relation {
  id: string;
  kind: RelationKind;
  code: string;
  label: string;
}

/**
 * Importe de un ticket, con la tasa CONGELADA al momento de registrarlo.
 * Nunca se recalcula: si se reconvirtiera con la tasa de hoy, los reportes
 * de meses cerrados cambiarían solos y nadie podría cuadrar nada.
 */
export interface TicketMoney {
  amount: number;
  currency: string;
  currency_name: string;
  /** Unidades de moneda base por una unidad de `currency`. La base vale 1. */
  rate: number;
  /** `amount * rate`, calculado y guardado al registrar. */
  amount_base: number;
  base_currency: string;
  rated_at: string;
  /** De dónde salió la tasa: la operación padre, carga manual o base. */
  rate_source: 'operation' | 'manual' | 'base';
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface TicketType {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  /** Un tipo raíz agrupa hijos: la operación aérea es el caso típico. */
  is_root: boolean;
  /** Códigos de tipo que pueden colgar de este. Vacío = no admite hijos. */
  child_type_codes: string[];
  default_role_id?: string;
  default_role_name?: string;
  blocks_parent_close: boolean;
  relation_kinds: RelationKind[];
  is_system: boolean;
  is_active: boolean;
  fields: FieldDef[];
  statuses: StatusDef[];
  steps: StepDef[];
  tickets_count: number;
}

export interface Ticket {
  id: string;
  code: string;
  /** Número oficial del formato: TVOA N°####-AA. */
  control_number?: string;
  type_code: string;
  type_name: string;
  type_is_root: boolean;
  title: string;
  status_code: string;
  status_name: string;
  status_color: StatusDef['color'];
  status_is_final: boolean;
  parent_id?: string;
  parent_code?: string;
  assigned_role_id?: string;
  assigned_role_name?: string;
  /** Responsable puntual. Opcional: sin él, el ticket es de quien tenga el rol. */
  assigned_user_id?: string;
  assigned_user_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_at?: string;
  closed_at?: string;
  payload: Record<string, unknown>;
  /** Presente solo si el tipo tiene un campo con rol `amount`. */
  money?: TicketMoney;
  /** Solo en operaciones: los pasajeros del vuelo. */
  passengers?: Passenger[];
  /** Reglas de negocio que se dispararon sobre este ticket. */
  rule_hits?: RuleHit[];
  /** Visto bueno de la dirección sobre un gasto que una regla marcó. */
  authorization?: TicketAuthorization;
  relations: Relation[];
  decisions: Decision[];
  comments: Comment[];
  /** Sello del cierre firmado. Solo en operaciones cerradas con firma; inmutable. */
  closing?: ClosingStamp;
  /** Archivos cargados en el ticket, con su lectura automática si aplica. */
  files: Attachment[];
  attachments: number;
  children_count: number;
}

export type RuleField = 'amount_base' | 'concept' | 'attachments' | 'amount_vs_route';
export type RuleOperator = 'gt' | 'lt' | 'eq' | 'missing';
export type RuleAction = 'require_authorization' | 'require_support' | 'warn';

/** Regla que el administrador declara desde la aplicación, sin desarrollo. */
export interface BusinessRule {
  id: string;
  name: string;
  type_code: string;
  field: RuleField;
  operator: RuleOperator;
  value?: number | string;
  action: RuleAction;
  message: string;
  is_active: boolean;
  /** Solo `amount_vs_route`: tope en moneda base por ruta, `ORIGEN-DESTINO`. */
  route_limits?: Record<string, number>;
}

export interface TicketAuthorization {
  by: string;
  role: string;
  at: string;
  note?: string;
  /** Importe autorizado: si el gasto cambia después, la autorización deja de valer. */
  amount_base: number;
}

/** Una regla que se disparó, con el motivo congelado al momento. */
export interface RuleHit {
  rule_id: string;
  rule_name: string;
  action: RuleAction;
  message: string;
  at: string;
}

export interface TicketSummary {
  total_children: number;
  open_children: number;
  blocking_children: number;
}

/** Pasajero de una operación, tomado del manifiesto. */
export interface Passenger {
  id: string;
  full_name: string;
  document: string;
  nationality?: string;
  /** Id del soporte (imagen del pasaporte) entre los archivos de la operación. */
  passport_file_id?: string;
}

/** Total por moneda. El desglose se conserva además del total en base. */
export interface MoneyTotal {
  currency: string;
  currency_name: string;
  amount: number;
  amount_base: number;
  count: number;
}

/** Totales de un ticket raíz y sus hijos, o de una consulta de gastos. */
export interface ExpenseTotals {
  base_currency: string;
  /** Solo estados con `counts_as_committed`. */
  committed_base: number;
  /** Registrado pero aún sin confirmar. */
  pending_base: number;
  /** Excluido del total: rechazados y anulados. */
  excluded_base: number;
  by_currency: MoneyTotal[];
  by_concept: { key: string; label: string; amount_base: number; count: number }[];
}

/**
 * Sello del cierre firmado, congelado al cerrar la operación: quién firmó, con
 * qué rúbrica y cuánto se gastó entonces. Después de cerrada, nada lo cambia.
 */
export interface ClosingStamp {
  /** Cierres anteriores a las firmas múltiples: un solo firmante. */
  signed_by: string;
  signed_role: string;
  /** Solo viaja en el resumen de cierre; el ticket trae `has_signature`. */
  signature_url?: string;
  has_signature?: boolean;
  signed_at: string;
  /** Firmas selladas, una por paso firmable. Vacío en cierres anteriores. Solo viaja en el resumen. */
  signatures?: ClosingSignature[];
  totals: ExpenseTotals;
  files_count: number;
  /** Carpeta del expediente en Blackbox. */
  folder: string;
}

/** Una firma sellada en el cierre (con la imagen, solo en el resumen de cierre). */
export interface ClosingSignature {
  step_code: string;
  step_name: string;
  role_name: string;
  user_name: string;
  signed_at: string;
  signature_url: string;
}

/** Un paso firmable del cierre y su estado, tal como lo ve quien consulta. */
export interface ClosingSigner {
  step_code: string;
  step_name: string;
  role_code: string;
  role_name: string;
  required: boolean;
  signed: boolean;
  signed_by_name: string | null;
  signed_at: string | null;
  /** El usuario puede firmar este paso: tiene su rol o `tickets.decide_any`. */
  can_sign: boolean;
  /** El usuario tiene su rúbrica cargada en el perfil. */
  has_signature: boolean;
}

export interface ClosingRoleProgress {
  role_id: string | null;
  role_name: string;
  done: number;
  total: number;
  pending: string[];
}

export interface ClosingExpenseRow {
  ticket_id: string;
  code: string;
  concept: string;
  amount: number;
  currency: string;
  amount_base: number;
  status: string;
  /** Si el estado cuenta en los totales (un rechazado no). */
  counts: boolean;
  has_support: boolean;
}

export interface ClosingSupport {
  ticket_id: string;
  ticket_code: string;
  file_id: string;
  document_type: string;
  name: string;
  mime: string;
  size: number;
  filename: string;
  folder: string;
  uploaded_by: string;
}

export type ClosingBlockerKind =
  | 'pending_step'
  | 'unresolved_child'
  | 'expense_without_support'
  | 'receipt_awaiting_validation'
  | 'signature';

export interface ClosingBlocker {
  kind: ClosingBlockerKind;
  ticket_id: string;
  ticket_code: string;
  /** Paso pendiente (`pending_step`) o archivo (`receipt_awaiting_validation`). */
  detail?: string;
  step_code?: string;
  /** Rol que debe firmar (`signature`). */
  role_name?: string;
}

export interface ClosingMoneyBlock {
  base: number;
  by_currency: MoneyTotal[];
}

export interface ClosingSummary {
  ticket_id: string;
  ticket_code: string;
  closed: boolean;
  progress: ClosingRoleProgress[];
  expenses: ClosingExpenseRow[];
  totals: ExpenseTotals;
  confirmed: ClosingMoneyBlock;
  in_progress: ClosingMoneyBlock;
  supports: ClosingSupport[];
  supports_by_type: { document_type: string; count: number }[];
  blockers: ClosingBlocker[];
  /** Sello inmutable del cierre, con la imagen de la firma. Nulo mientras esté abierta. */
  stamp?: ClosingStamp | null;
  /** Nada impide cerrar: todo resuelto y todas las firmas puestas. */
  ready: boolean;
  /** Pasos firmables del cierre, en orden. */
  signers: ClosingSigner[];
}
