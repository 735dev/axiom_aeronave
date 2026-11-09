import { z } from 'zod';

export const moduleSchema = z.object({
  name: z.string().min(3, 'errors.minLength|3').max(60, 'errors.maxLength|60'),
  code: z
    .string()
    .regex(/^[a-z_]*$/, 'permissions.invalidAction')
    .max(30, 'errors.maxLength|30')
    .optional()
    .or(z.literal('')),
  description: z.string().max(160, 'errors.maxLength|160').optional().or(z.literal('')),
});

export type ModuleInput = z.infer<typeof moduleSchema>;
