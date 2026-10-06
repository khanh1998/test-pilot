import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse, MessageResponse } from './common';

// ── Shared schemas ────────────────────────────────────────────────────────────

export const AgentToken = registry.register(
  'AgentToken',
  z.object({
    id: z.number().int(),
    userId: z.number().int(),
    name: z.string(),
    tokenPrefix: z.string(),
    expiresAt: z.string().datetime().nullable(),
    revokedAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
);

// ── Request / response schemas ────────────────────────────────────────────────

export const CreateAgentTokenRequest = registry.register(
  'CreateAgentTokenRequest',
  z.object({
    name: z.string().min(1).max(255),
    expiresAt: z.string().datetime().nullable().optional()
  })
);

export const CreateAgentTokenResponse = registry.register(
  'CreateAgentTokenResponse',
  z.object({
    token: AgentToken,
    plainTextToken: z.string().openapi({ description: 'Only returned once — store it securely' })
  })
);

export const ListAgentTokensResponse = registry.register(
  'ListAgentTokensResponse',
  z.object({ tokens: z.array(AgentToken) })
);

export const RevokeAgentTokenResponse = registry.register(
  'RevokeAgentTokenResponse',
  z.object({ token: AgentToken })
);

// ── Path param helpers (reused across routes) ─────────────────────────────────

export const tokenIdParam = z.object({
  id: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/agents/tokens',
  summary: 'List agent tokens',
  tags: ['Agents'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ListAgentTokensResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/agents/tokens',
  summary: 'Create an agent token',
  tags: ['Agents'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateAgentTokenRequest } } }
  },
  responses: {
    201: {
      description: 'Token created',
      content: { 'application/json': { schema: CreateAgentTokenResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/agents/tokens/{id}',
  summary: 'Delete an agent token',
  tags: ['Agents'],
  security: [{ bearerAuth: [] }],
  request: { params: tokenIdParam },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/agents/tokens/{id}/revoke',
  summary: 'Revoke an agent token',
  tags: ['Agents'],
  security: [{ bearerAuth: [] }],
  request: { params: tokenIdParam },
  responses: {
    200: {
      description: 'Token revoked',
      content: { 'application/json': { schema: RevokeAgentTokenResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
