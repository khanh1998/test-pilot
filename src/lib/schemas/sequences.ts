import { z } from 'zod';
import type { FlowLoopDefinition } from '../types/flow_sequence';
import { registry } from './registry';
import { ErrorResponse, MessageResponse } from './common';
import { ExecutionPreferences, RunLog, ValueMap } from './flow-data';

// ── Shared schemas ────────────────────────────────────────────────────────────

const FlowParameterMapping = z.object({
  flow_parameter_name: z.string(),
  source_type: z.enum([
    'environment_variable',
    'previous_output',
    'static_value',
    'function',
    'loop_value'
  ]),
  source_value: z.string(),
  data_type: z.enum(['string', 'number', 'boolean']).optional(),
  source_flow_step: z.number().int().optional(),
  source_output_field: z.string().optional(),
  loop_id: z.string().optional(),
  loop_source_id: z.string().optional()
});

const LoopSource = z.object({
  id: z.string(),
  alias: z.string(),
  source_type: z.enum(['fixed_count', 'environment_variable_array', 'previous_output_array']),
  count: z.number().optional(),
  source_value: z.string().optional(),
  source_flow_step: z.number().int().optional(),
  source_output_field: z.string().optional()
});
registry.register('FlowLoopSource', LoopSource);
// Explicit OpenAPI metadata gives the recursive runtime schema a finite $ref representation.
const LoopDefinition: z.ZodType<FlowLoopDefinition> = registry.register(
  'FlowLoopDefinition',
  z
    .lazy(() =>
      z.object({
        id: z.string(),
        name: z.string(),
        sources: z.array(LoopSource),
        children: z.array(LoopDefinition).optional()
      })
    )
    .openapi({
      type: 'object',
      required: ['id', 'name', 'sources'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        sources: { type: 'array', items: { $ref: '#/components/schemas/FlowLoopSource' } },
        children: { type: 'array', items: { $ref: '#/components/schemas/FlowLoopDefinition' } }
      }
    })
);

const FlowSequenceStep = z.object({
  id: z.string(),
  test_flow_id: z.number().int(),
  step_order: z.number().int(),
  parameter_mappings: z.array(FlowParameterMapping),
  loop_config: z.looseObject({ enabled: z.boolean(), root: LoopDefinition.optional() }).optional(),
  conditions: z
    .array(
      z.object({
        type: z.enum(['success', 'failure', 'always', 'custom']),
        expression: z.string().optional()
      })
    )
    .optional(),
  retry_config: z
    .object({
      max_attempts: z.number().int().min(0),
      delay_ms: z.number().min(0),
      backoff_multiplier: z.number().optional()
    })
    .optional(),
  expects_error: z.boolean().optional()
});

const FlowSequenceConfig = z.object({
  steps: z.array(FlowSequenceStep),
  global_settings: z
    .object({
      timeout: z.number().optional(),
      continue_on_error: z.boolean().optional(),
      parallel_execution: z.boolean().optional()
    })
    .optional()
});

const FlowSequence = registry.register(
  'FlowSequence',
  z.object({
    id: z.number().int(),
    moduleId: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    sequenceConfig: FlowSequenceConfig,
    displayOrder: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const CreateSequenceRequest = registry.register(
  'CreateSequenceRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
);

export const UpdateSequenceRequest = registry.register(
  'UpdateSequenceRequest',
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    sequenceConfig: FlowSequenceConfig.optional(),
    displayOrder: z.number().int().optional()
  })
);

export const CloneSequenceRequest = registry.register(
  'CloneSequenceRequest',
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
);

export const AddFlowToSequenceRequest = registry.register(
  'AddFlowToSequenceRequest',
  z.object({
    test_flow_id: z.number().int(),
    step_order: z.number().int().optional(),
    parameter_mappings: z.array(FlowParameterMapping).optional()
  })
);

const SequenceRunEnvironment = z.object({
  environmentId: z.number().int().positive(),
  subEnvironment: z.string().min(1)
});

export const RunSequenceRequest = registry.register(
  'RunSequenceRequest',
  z.object({
    environment: SequenceRunEnvironment,
    preferences: ExecutionPreferences.optional()
  })
);

export const RunSequencesBatchRequest = registry.register(
  'RunSequencesBatchRequest',
  z.object({
    environment: SequenceRunEnvironment,
    preferences: ExecutionPreferences.optional(),
    mode: z.enum(['sequential', 'parallel']).default('sequential').optional(),
    sequenceIds: z.array(z.number().int().positive()).optional()
  })
);

// ── Response schemas ──────────────────────────────────────────────────────────

const SequenceListResponse = registry.register(
  'SequenceListResponse',
  z.object({
    sequences: z.array(FlowSequence),
    total: z.number().int()
  })
);

const SequenceWrappedResponse = registry.register(
  'SequenceWrappedResponse',
  z.object({ sequence: FlowSequence })
);

export const SequenceRunResponse = registry.register(
  'SequenceRunResponse',
  z.object({
    status: z.enum(['completed', 'failed', 'error']),
    success: z.boolean(),
    summary: z.string(),
    sequenceId: z.number().int(),
    sequenceName: z.string(),
    totalFlows: z.number().int(),
    completedFlows: z.number().int(),
    flowResults: z.array(
      z.object({
        flowId: z.number().int(),
        flowName: z.string(),
        stepOrder: z.number().int(),
        success: z.boolean(),
        expectsError: z.boolean(),
        matchedExpectation: z.boolean(),
        error: z.unknown().optional(),
        outputs: ValueMap,
        responses: ValueMap,
        parameterValues: ValueMap,
        executionState: ValueMap,
        executionTime: z.number(),
        loop: ValueMap.optional()
      })
    ),
    logs: z.array(RunLog),
    error: z.string().optional()
  })
);
export const BatchSequenceRunResponse = registry.register(
  'BatchSequenceRunResponse',
  z.object({
    success: z.boolean(),
    summary: z.string(),
    totalSequences: z.number().int(),
    successCount: z.number().int(),
    failCount: z.number().int(),
    skippedCount: z.number().int(),
    results: z.array(SequenceRunResponse)
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const moduleParams = z.object({
  id: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive()
});

export const sequenceParams = z.object({
  id: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive(),
  sequenceId: z.coerce.number().int().positive()
});

export const flowStepParams = z.object({
  id: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive(),
  sequenceId: z.coerce.number().int().positive(),
  stepId: z.string().min(1)
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}/modules/{moduleId}/sequences',
  summary: 'List sequences for a module',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
      moduleId: z.coerce.number().int().positive()
    })
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: SequenceListResponse } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences',
  summary: 'Create a sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
      moduleId: z.coerce.number().int().positive()
    }),
    body: { content: { 'application/json': { schema: CreateSequenceRequest } } }
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: SequenceWrappedResponse } }
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
  method: 'get',
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}',
  summary: 'Get sequence detail',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: { params: sequenceParams },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: SequenceWrappedResponse } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}',
  summary: 'Update a sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: sequenceParams,
    body: { content: { 'application/json': { schema: UpdateSequenceRequest } } }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SequenceWrappedResponse } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}',
  summary: 'Delete a sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: { params: sequenceParams },
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}/clone',
  summary: 'Clone a sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: sequenceParams,
    body: { content: { 'application/json': { schema: CloneSequenceRequest } } }
  },
  responses: {
    201: {
      description: 'Cloned',
      content: { 'application/json': { schema: SequenceWrappedResponse } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}/flows',
  summary: 'Add a test flow to sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: sequenceParams,
    body: { content: { 'application/json': { schema: AddFlowToSequenceRequest } } }
  },
  responses: {
    201: {
      description: 'Added',
      content: { 'application/json': { schema: z.object({ result: FlowSequence }) } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}/flows/{stepId}',
  summary: 'Remove a flow from sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: { params: flowStepParams },
  responses: {
    200: { description: 'Removed', content: { 'application/json': { schema: MessageResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/projects/{id}/modules/{moduleId}/sequences/{sequenceId}/runs',
  summary: 'Run a single sequence',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: sequenceParams,
    body: { content: { 'application/json': { schema: RunSequenceRequest } } }
  },
  responses: {
    200: {
      description: 'Run result',
      content: { 'application/json': { schema: SequenceRunResponse } }
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
  path: '/api/projects/{id}/modules/{moduleId}/sequences/runs',
  summary: 'Run multiple sequences in a module',
  tags: ['Sequences'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
      moduleId: z.coerce.number().int().positive()
    }),
    body: { content: { 'application/json': { schema: RunSequencesBatchRequest } } }
  },
  responses: {
    200: {
      description: 'Run results',
      content: { 'application/json': { schema: BatchSequenceRunResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});
