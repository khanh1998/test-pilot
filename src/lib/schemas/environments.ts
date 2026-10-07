import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';

// ── Shared schemas ────────────────────────────────────────────────────────────

const SubEnvironment = z.object({
  name: z.string(),
  description: z.string().optional(),
  variables: z.record(z.string(), z.unknown()),
  api_hosts: z.record(z.string(), z.string())
});

const VariableDefinition = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  required: z.boolean(),
  default_value: z.unknown()
});

export const EnvironmentConfig = registry.register(
  'EnvironmentConfig',
  z.object({
    type: z.enum(['environment_set', 'single_environment']),
    environments: z.record(z.string(), SubEnvironment),
    variable_definitions: z.record(z.string(), VariableDefinition),
    linked_apis: z.array(z.number().int()).optional()
  })
);

export const Environment = registry.register(
  'Environment',
  z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    userId: z.number().int(),
    config: EnvironmentConfig,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateEnvironmentRequest = registry.register(
  'CreateEnvironmentRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    config: EnvironmentConfig
  })
);

export const UpdateEnvironmentRequest = registry.register(
  'UpdateEnvironmentRequest',
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    config: EnvironmentConfig.optional()
  })
);

// ── Response schemas ──────────────────────────────────────────────────────────

const DeleteEnvironmentResponse = registry.register(
  'DeleteEnvironmentResponse',
  z.object({
    success: z.boolean(),
    id: z.number().int()
  })
);

const EnvironmentApiLinkResponse = registry.register(
  'EnvironmentApiLinkResponse',
  z.object({
    success: z.boolean(),
    environmentId: z.number().int(),
    apiId: z.number().int()
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const DeleteEnvironmentQuery = z.object({
  force: z.enum(['true', 'false']).transform((value) => value === 'true')
});

export const envIdParam = z.object({
  envId: z.coerce.number().int().positive()
});

export const envApiIdParam = z.object({
  envId: z.coerce.number().int().positive(),
  apiId: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/environments',
  summary: 'List environments for authenticated user',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: z.array(Environment) } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/environments',
  summary: 'Create an environment',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateEnvironmentRequest } } }
  },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: Environment } } },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'get',
  path: '/api/environments/{envId}',
  summary: 'Get environment by ID',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: { params: envIdParam },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: Environment } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'put',
  path: '/api/environments/{envId}',
  summary: 'Update an environment',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: {
    params: envIdParam,
    body: { content: { 'application/json': { schema: UpdateEnvironmentRequest } } }
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: Environment } } },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/environments/{envId}',
  summary: 'Delete an environment',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: { params: envIdParam, query: DeleteEnvironmentQuery },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: DeleteEnvironmentResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    409: {
      description:
        'Environment is linked to test flows (cannot be forced) or to projects (retry with force=true to unlink and delete)',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/environments/{envId}/apis/{apiId}',
  summary: 'Link API to environment',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: { params: envApiIdParam },
  responses: {
    200: {
      description: 'Linked',
      content: { 'application/json': { schema: EnvironmentApiLinkResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    409: {
      description: 'Already linked',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'delete',
  path: '/api/environments/{envId}/apis/{apiId}',
  summary: 'Unlink API from environment',
  tags: ['Environments'],
  security: [{ bearerAuth: [] }],
  request: { params: envApiIdParam },
  responses: {
    200: {
      description: 'Unlinked',
      content: { 'application/json': { schema: EnvironmentApiLinkResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
