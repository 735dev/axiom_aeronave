import { dataUrlBytes } from '../blackbox';
import { currentAuditActor, recordAudit } from '../auditDb';
import { adminState, MockResponse } from './adminRoutes';
import {
  SIGNATURE_MAX_BYTES,
  SIGNATURE_MIME_TYPES,
  signatureProblem,
} from '@/shared/utils/signatureRules';

function validation(detail: string): MockResponse {
  return {
    status: 422,
    data: { title: 'errors.validationTitle', detail, errors: { signature_url: detail } },
  };
}

/**
 * Firma del propio usuario. El dueño sale SIEMPRE del token: aunque el cuerpo
 * traiga un `user_id`, se ignora. Si no, cualquiera podría firmar por otro.
 */
export function routeProfile(
  method: string,
  path: string,
  body: Record<string, unknown>,
): MockResponse | null {
  if (path !== '/auth/me/signature/') return null;
  const me = adminState.users.find((u) => u.id === currentAuditActor().id);
  if (!me || !me.is_active) return { status: 401, data: { title: 'errors.unauthorizedTitle' } };

  if (method === 'get') return { status: 200, data: { signature_url: me.signature_url ?? null } };
  if (method !== 'patch' && method !== 'put') return null;

  const raw = body.signature_url;
  const next = raw === undefined || raw === null ? '' : String(raw);

  if (next !== '') {
    const m = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(next);
    if (!m) return validation('La firma debe ser una imagen PNG o JPEG válida.');
    const problem = signatureProblem(m[1] ?? '', dataUrlBytes(next));
    if (problem === 'type') {
      return validation(
        `La firma debe ser ${SIGNATURE_MIME_TYPES.map((x) => x.split('/')[1]?.toUpperCase()).join(' o ')}.`,
      );
    }
    if (problem === 'size') {
      return validation(`La firma no puede superar ${SIGNATURE_MAX_BYTES / 1024} KB.`);
    }
    if (problem === 'empty') return validation('La imagen de la firma está vacía.');
  }

  const had = Boolean(me.signature_url);
  const value = next || undefined;
  if (value !== me.signature_url) {
    // La rúbrica respalda un cierre firmado: cada cambio se asienta, sin la imagen.
    recordAudit({
      action: 'permission_change',
      entity: 'user',
      entity_id: me.id,
      entity_label: me.email,
      summary: value
        ? `${had ? 'Reemplazó' : 'Cargó'} la firma de ${me.full_name}`
        : `Eliminó la firma de ${me.full_name}`,
      changes: [
        {
          field: 'signature',
          label: 'Firma digital',
          from: had ? 'registrada' : null,
          to: value ? 'registrada' : null,
        },
      ],
    });
  }
  me.signature_url = value;
  return { status: 200, data: { signature_url: me.signature_url ?? null } };
}
