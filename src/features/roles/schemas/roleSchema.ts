import { z } from 'zod';

export const roleSchema = z.object({
  name: z.string().min(3, 'errors.minLength|3').max(60, 'errors.maxLength|60'),
  description: z.string().max(200, 'errors.maxLength|200').optional().or(z.literal('')),
});

export type RoleInput = z.infer<typeof roleSchema>;
