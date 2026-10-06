import { z } from 'zod';
import { registry } from './registry';

export const ErrorResponse = registry.register(
  'ErrorResponse',
  z.union([
    z.object({ error: z.string(), details: z.string().optional() }),
    z.object({ message: z.string() })
  ])
);

export const MessageResponse = registry.register(
  'MessageResponse',
  z.object({ message: z.string() })
);
