import { z } from 'zod';
import { FieldDef } from '../types/ticket.types';

/**
 * Construye el esquema de validación a partir de la definición de campos del
 * tipo de ticket. El formulario no conoce sus campos hasta que carga el tipo.
 */
export function buildDynamicSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let rule: z.ZodTypeAny;

    switch (field.type) {
      case 'number':
      case 'money': {
        const base = z.number({ invalid_type_error: 'errors.required' });
        rule = field.required
          ? base.positive('errors.positive')
          : // Un campo numérico vacío llega como cadena: se normaliza a undefined
            // para que la validación opcional no lo trate como número inválido.
            z.preprocess(
              (value) => (value === '' || value === null || Number.isNaN(value) ? undefined : value),
              base.optional(),
            );
        break;
      }
      case 'checkbox':
        rule = z.boolean().optional();
        break;
      case 'checkbox_group':
        rule = z.array(z.string()).optional();
        break;
      case 'file':
        rule = z.instanceof(File).nullable().optional();
        break;
      default: {
        const base = z.string();
        rule = field.required ? base.min(1, 'errors.required') : base.optional().or(z.literal(''));
      }
    }

    shape[field.key] = rule;
  });

  return z.object(shape);
}

export type DynamicValues = Record<string, unknown>;
