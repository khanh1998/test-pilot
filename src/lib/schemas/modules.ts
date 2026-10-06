import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse, MessageResponse } from './common';

// ── Shared schemas ────────────────────────────────────────────────────────────

const ProjectModule = registry.register(
  'ProjectModuleDetail',
  z.object({
    id: z.number().int(),
    projectId: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    displayOrder: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    sequenceCount: z.number().int().optional()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateModuleRequest = registry.register(
  'CreateModuleRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
);

export const UpdateModuleRequest = registry.register(
  'UpdateModuleRequest',
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    displayOrder: z.number().int().optional()
  })
);

// ── Response schemas ──────────────────────────────────────────────────────────

const ModuleListResponse = registry.register(
  'ModuleListResponse',
  z.object({
    modules: z.array(ProjectModule),
    total: z.number().int()
  })
);

const ModuleWrappedResponse = registry.register(
  'ModuleWrappedResponse',
  z.object({ module: ProjectModule })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const projectModuleIdParam = z.object({
  id: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/modules',
  summary: 'List modules for a project',
  tags: ['Modules'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.coerce.number().int().positive() }) },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ModuleListResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/projects/{id}/modules',
  summary: 'Create a module',
  tags: ['Modules'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: { content: { 'application/json': { schema: CreateModuleRequest } } }
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ModuleWrappedResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/modules/{moduleId}',
  summary: 'Get module detail',
  tags: ['Modules'],
  security: [{ bearerAuth: [] }],
  request: { params: projectModuleIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: ModuleWrappedResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'put',
  path: '/api/projects/{id}/modules/{moduleId}',
  summary: 'Update a module',
  tags: ['Modules'],
  security: [{ bearerAuth: [] }],
  request: {
    params: projectModuleIdParam,
    body: { content: { 'application/json': { schema: UpdateModuleRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: ModuleWrappedResponse } }
    },
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
  path: '/api/projects/{id}/modules/{moduleId}',
  summary: 'Delete a module',
  tags: ['Modules'],
  security: [{ bearerAuth: [] }],
  request: { params: projectModuleIdParam },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
