import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('errors.email'),
  password: z.string().min(4, 'errors.minLength|4'),
});

export type LoginInput = z.infer<typeof loginSchema>;
