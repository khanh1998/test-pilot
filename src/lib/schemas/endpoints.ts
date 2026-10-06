import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';
import { ApiEndpoint } from './apis';

export const SearchEndpointsQuery = z.object({
  query: z.string().trim().min(1),
  apiId: z.coerce.number().int().optional(),
  apiIds: z.array(z.coerce.number().int()).optional(),
  limit: z.coerce.number().int().positive().default(10).optional()
});

// ── Response schemas ──────────────────────────────────────────────────────────

const GetEndpointDetailsResponse = registry.register(
  'GetEndpointDetailsResponse',
  z.object({
    success: z.boolean(),
    data: ApiEndpoint
  })
);

const SearchEndpointsResponse = registry.register(
  'SearchEndpointsResponse',
  z.object({
    success: z.boolean(),
    data: z.array(
      ApiEndpoint.omit({ requestSchema: true, responseSchema: true, parameters: true }).extend({
        relevanceScore: z.number()
      })
    ),
    count: z.number().int()
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const endpointIdParam = z.object({
  id: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/endpoints/{id}',
  summary: 'Get endpoint details',
  tags: ['Endpoints'],
  security: [{ bearerAuth: [] }],
  request: { params: endpointIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: GetEndpointDetailsResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'get',
  path: '/api/endpoints/search',
  summary: 'Search endpoints by description',
  tags: ['Endpoints'],
  security: [{ bearerAuth: [] }],
  request: {
    query: SearchEndpointsQuery
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: SearchEndpointsResponse } }
    },
    400: {
      description: 'Missing query',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
