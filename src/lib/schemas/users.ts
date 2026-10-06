import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';

// ── Response schemas ──────────────────────────────────────────────────────────

const User = registry.register(
  'User',
  z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string().email(),
    supabaseAuthId: z.string().nullable(),
    createdAt: z.string().datetime()
  })
);

const ListUsersResponse = registry.register(
  'ListUsersResponse',
  z.object({
    users: z.array(User),
    currentUser: z
      .object({
        userId: z.number().int(),
        email: z.string().email()
      })
      .nullable()
  })
);

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/users',
  summary: 'List users (debug endpoint)',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: ListUsersResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
