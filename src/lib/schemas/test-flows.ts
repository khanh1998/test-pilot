import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';
import { TestFlowJson, ExecutionPreferences, TestFlowRunResponse } from './flow-data';

export const ListTestFlowsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().default(''),
  projectId: z.coerce.number().int().positive().optional()
});

// ── Shared schemas ────────────────────────────────────────────────────────────

export const TestFlowRecord = registry.register(
  'TestFlowRecord',
  z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    userId: z.number().int().nullable(),
    projectId: z.number().int().nullable(),
    environmentId: z.number().int().nullable(),
    apis: z.array(z.object({ id: z.number().int(), name: z.string().optional() })).optional(),
    endpoints: z
      .array(
        z.looseObject({
          id: z.number().int(),
          apiId: z.number().int(),
          path: z.string(),
          method: z.string()
        })
      )
      .optional(),
    flowJson: TestFlowJson,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateTestFlowRequest = registry.register(
  'CreateTestFlowRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    apiIds: z.array(z.number().int()).min(1),
    projectId: z.number().int().optional(),
    flowJson: TestFlowJson.optional()
  })
);

export const UpdateTestFlowRequest = registry.register(
  'UpdateTestFlowRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    apiIds: z.array(z.number().int()).optional(),
    flowJson: TestFlowJson.optional()
  })
);

export const CloneTestFlowRequest = registry.register(
  'CloneTestFlowRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
);

export const DeleteTestFlowRequest = registry.register(
  'DeleteTestFlowRequest',
  z.object({
    id: z.number().int()
  })
);

export const RunTestFlowRequest = registry.register(
  'RunTestFlowRequest',
  z.object({
    mode: z.enum(['sync', 'async']).default('sync').optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    environment: z
      .object({
        environmentId: z.coerce.number().int().positive().optional(),
        subEnvironment: z.string().optional()
      })
      .optional(),
    preferences: ExecutionPreferences.optional()
  })
);

// ── Response schemas ──────────────────────────────────────────────────────────

export const TestFlowListResponse = registry.register(
  'TestFlowListResponse',
  z.object({
    testFlows: z.array(
      TestFlowRecord.pick({
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true
      })
    ),
    pagination: z.object({
      total: z.number().int(),
      page: z.number().int(),
      limit: z.number().int(),
      totalPages: z.number().int(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    })
  })
);

const DeleteTestFlowResponse = registry.register(
  'DeleteTestFlowResponse',
  z.object({
    success: z.boolean(),
    id: z.number().int()
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const testFlowIdParam = z.object({
  id: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/test-flows',
  summary: 'List test flows',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: {
    query: ListTestFlowsQuery
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: TestFlowListResponse } }
    },
    400: {
      description: 'Invalid params',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/test-flows',
  summary: 'Create a test flow',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateTestFlowRequest } } }
  },
  responses: {
    200: {
      description: 'Created',
      content: { 'application/json': { schema: z.object({ testFlow: TestFlowRecord }) } }
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
  path: '/api/test-flows',
  summary: 'Delete a test flow (ID in body)',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: DeleteTestFlowRequest } } }
  },
  responses: {
    200: {
      description: 'Deleted',
      content: { 'application/json': { schema: DeleteTestFlowResponse } }
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
  path: '/api/test-flows/{id}',
  summary: 'Get a test flow by ID',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: { params: testFlowIdParam },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: z.object({ testFlow: TestFlowRecord }) } }
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
  path: '/api/test-flows/{id}',
  summary: 'Update a test flow',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: {
    params: testFlowIdParam,
    body: { content: { 'application/json': { schema: UpdateTestFlowRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: z.object({ testFlow: TestFlowRecord }) } }
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
  method: 'post',
  path: '/api/test-flows/{id}/clone',
  summary: 'Clone a test flow',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }],
  request: {
    params: testFlowIdParam,
    body: { content: { 'application/json': { schema: CloneTestFlowRequest } } }
  },
  responses: {
    200: {
      description: 'Cloned',
      content: { 'application/json': { schema: z.object({ testFlow: TestFlowRecord }) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/test-flows/{id}/runs',
  summary: 'Run a test flow',
  tags: ['Test Flows'],
  security: [{ bearerAuth: [] }, { agentTokenAuth: [] }],
  request: {
    params: testFlowIdParam,
    body: { content: { 'application/json': { schema: RunTestFlowRequest } } }
  },
  responses: {
    200: {
      description: 'Run result',
      content: { 'application/json': { schema: TestFlowRunResponse } }
    },
    400: {
      description: 'Validation error or missing params',
      content: { 'application/json': { schema: z.union([ErrorResponse, TestFlowRunResponse]) } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } },
    501: {
      description: 'Async not implemented',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});
