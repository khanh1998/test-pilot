import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';

export const ListApisQuery = z.object({
  projectId: z.coerce.number().int().positive().optional()
});

// ── Shared schemas ────────────────────────────────────────────────────────────

export const Api = registry.register(
  'Api',
  z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    host: z.string().nullable(),
    projectId: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    endpointCount: z.number().int().optional()
  })
);

export const ApiEndpoint = registry.register(
  'ApiEndpoint',
  z.object({
    id: z.number().int(),
    apiId: z.number().int(),
    path: z.string(),
    method: z.string(),
    operationId: z.string().nullable(),
    summary: z.string().nullable(),
    description: z.string().nullable(),
    requestSchema: z.unknown().nullable(),
    responseSchema: z.unknown().nullable(),
    parameters: z.unknown().nullable(),
    tags: z.array(z.string()).nullable(),
    createdAt: z.string().datetime()
  })
);

const EndpointCreateBody = z.object({
  path: z.string().trim().startsWith('/'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
  operationId: z.string().trim().nullable().optional(),
  summary: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  requestSchema: z.unknown().nullable().optional(),
  responseSchema: z.unknown().nullable().optional(),
  parameters: z.array(z.record(z.string(), z.unknown())).default([]),
  tags: z.array(z.string().trim().min(1)).default([])
});

// ── Response schemas ──────────────────────────────────────────────────────────

const GetApisResponse = registry.register('GetApisResponse', z.object({ apis: z.array(Api) }));

const GetApiDetailsResponse = registry.register('GetApiDetailsResponse', z.object({ api: Api }));

const GetApiEndpointsResponse = registry.register(
  'GetApiEndpointsResponse',
  z.object({ api: Api.omit({ projectId: true }), endpoints: z.array(ApiEndpoint) })
);

const DeleteApiResponse = registry.register(
  'DeleteApiResponse',
  z.object({
    success: z.boolean(),
    message: z.string()
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const apiIdParam = z.object({
  id: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/apis',
  summary: 'List APIs for authenticated user',
  tags: ['APIs'],
  security: [{ bearerAuth: [] }],
  request: {
    query: ListApisQuery
  },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: GetApisResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/apis/{id}/endpoints',
  summary: 'Create an endpoint and add it to the OpenAPI document',
  tags: ['APIs', 'Endpoints'],
  security: [{ bearerAuth: [] }],
  request: {
    params: apiIdParam,
    body: { content: { 'application/json': { schema: EndpointCreateBody } } }
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: ApiEndpoint } } },
    400: {
      description: 'Invalid endpoint',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: {
      description: 'API not found',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    409: {
      description: 'Endpoint already exists',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/api/apis/{id}',
  summary: 'Get API details',
  tags: ['APIs'],
  security: [{ bearerAuth: [] }],
  request: { params: apiIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: GetApiDetailsResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    403: {
      description: 'Access denied',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/apis/{id}',
  summary: 'Delete an API',
  tags: ['APIs'],
  security: [{ bearerAuth: [] }],
  request: { params: apiIdParam },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: DeleteApiResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    403: {
      description: 'Access denied',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'get',
  path: '/api/apis/{id}/endpoints',
  summary: 'List endpoints for an API',
  tags: ['APIs'],
  security: [{ bearerAuth: [] }],
  request: { params: apiIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: GetApiEndpointsResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    403: {
      description: 'Access denied',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
