import { z } from 'zod';

export const userSchema = z.object({
  full_name: z.string().min(3, 'errors.minLength|3').max(80, 'errors.maxLength|80'),
  email: z.string().email('errors.email'),
  phone: z.string().max(20, 'errors.maxLength|20').optional().or(z.literal('')),
  avatar_url: z.string().optional().or(z.literal('')),
  role_id: z.string().min(1, 'errors.required'),
  location: z.string().optional().or(z.literal('')),
  aircraft_id: z.string().optional().or(z.literal('')),
});

export type UserInput = z.infer<typeof userSchema>;
