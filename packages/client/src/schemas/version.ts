import { z } from 'zod';

export const serverVersionSchema = z.object({
  version: z.string(),
});

export type ServerVersion = z.infer<typeof serverVersionSchema>;
