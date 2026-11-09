import { z } from 'zod';

export const catalogItemSchema = z.object({
  name: z.string().min(2, 'errors.minLength|2').max(80, 'errors.maxLength|80'),
  code: z.string().max(30, 'errors.maxLength|30').optional().or(z.literal('')),
  extra: z.string().max(80, 'errors.maxLength|80').optional().or(z.literal('')),
});

export type CatalogItemInput = z.infer<typeof catalogItemSchema>;
