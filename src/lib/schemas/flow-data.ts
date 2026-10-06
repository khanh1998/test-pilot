import { z } from 'zod';
import { registry } from './registry';

const valueType = z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']);
const referenceId = z.union([z.number().int().positive(), z.string().min(1)]);
const stringMap = z.record(z.string(), z.string());

export const FlowAssertion = registry.register(
  'FlowAssertion',
  z.looseObject({
    id: z.string(),
    data_source: z.enum(['response', 'transformed_data']),
    assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
    data_id: z.string(),
    operator: z.enum([
      'equals',
      'not_equals',
      'contains',
      'exists',
      'greater_than',
      'less_than',
      'starts_with',
      'ends_with',
      'matches_regex',
      'not_contains',
      'is_empty',
      'is_not_empty',
      'greater_than_or_equal',
      'less_than_or_equal',
      'between',
      'not_between',
      'has_length',
      'length_greater_than',
      'length_less_than',
      'contains_all',
      'contains_any',
      'not_contains_any',
      'one_of',
      'not_one_of',
      'is_type',
      'is_null',
      'is_not_null'
    ]),
    expected_value: z.unknown().optional(),
    enabled: z.boolean(),
    is_template_expression: z.boolean().optional()
  })
);

export const FlowEndpoint = registry.register(
  'FlowEndpoint',
  z.looseObject({
    endpoint_id: referenceId,
    api_id: referenceId,
    order: z.number().optional(),
    pathParams: stringMap.optional(),
    queryParams: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    body: z.unknown().optional(),
    headers: z
      .array(z.object({ name: z.string(), value: z.string(), enabled: z.boolean() }))
      .optional(),
    transformations: z.array(z.object({ alias: z.string(), expression: z.string() })).optional(),
    assertions: z.array(FlowAssertion).optional(),
    skipDefaultStatusCheck: z.boolean().optional()
  })
);

export const FlowParameter = registry.register(
  'FlowParameter',
  z.looseObject({
    name: z.string(),
    type: valueType,
    required: z.boolean(),
    value: z.unknown().optional(),
    defaultValue: z.unknown().optional(),
    description: z.string().optional()
  })
);
export const FlowOutput = registry.register(
  'FlowOutput',
  z.looseObject({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    type: z.enum([...valueType.options, 'unknown']).optional(),
    arrayItemType: z.enum(['string', 'number', 'boolean', 'object', 'unknown']).optional(),
    castToType: z.boolean().optional()
  })
);

// Preserve extension fields and endpoint snapshots when saving an existing flow.
// Older/default flows legitimately omit parameters and settings.
export const TestFlowJson = registry.register(
  'TestFlowJson',
  z.looseObject({
    steps: z.array(
      z.looseObject({
        step_id: z.string(),
        label: z.string(),
        endpoints: z.array(FlowEndpoint),
        timeout: z.number().optional(),
        clearCookiesBeforeExecution: z.boolean().optional()
      })
    ),
    parameters: z.array(FlowParameter).optional(),
    outputs: z.array(FlowOutput).optional(),
    settings: z
      .looseObject({
        api_hosts: z
          .record(
            z.string(),
            z.looseObject({
              url: z.string(),
              name: z.string().optional(),
              description: z.string().optional()
            })
          )
          .optional(),
        environment: z
          .object({
            environmentId: z.number().int().nullable(),
            subEnvironment: z.string().nullable()
          })
          .optional(),
        linkedEnvironment: z
          .object({
            environmentId: z.number().int(),
            environmentName: z.string(),
            parameterMappings: stringMap
          })
          .nullable()
          .optional()
      })
      .optional(),
    endpoints: z
      .array(
        z.looseObject({
          id: z.number().int(),
          apiId: z.number().int(),
          path: z.string(),
          method: z.string()
        })
      )
      .optional()
  })
);

export const ExecutionPreferences = registry.register(
  'ExecutionPreferences',
  z.object({
    parallelExecution: z.boolean().optional(),
    stopOnError: z.boolean().optional(),
    serverCookieHandling: z.boolean().optional(),
    retryCount: z.number().int().min(0).optional(),
    timeout: z.number().positive().optional()
  })
);

export const RunLog = z.object({
  level: z.string(),
  message: z.string(),
  details: z.string().optional()
});
export const ValueMap = z.record(z.string(), z.unknown());
export const TestFlowRunResponse = registry.register(
  'TestFlowRunResponse',
  z.object({
    status: z.enum(['completed', 'failed', 'missing_parameters']),
    success: z.boolean(),
    summary: z.string(),
    executionState: ValueMap,
    storedResponses: ValueMap,
    storedTransformations: z.record(z.string(), ValueMap),
    parameterValues: ValueMap,
    flowOutputs: ValueMap,
    logs: z.array(RunLog),
    missingParameters: z.array(z.string()).optional(),
    error: z.string().optional()
  })
);
