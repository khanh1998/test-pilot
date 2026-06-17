import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { isValidOperator } from '$lib/assertions';
import type { Assertion, AssertionOperator } from '$lib/assertions/types';
import type { StepEndpoint } from '$lib/components/test-flows/types';
import { explainFlowDocument, type FlowDocument, validateFlowDocument } from '$lib/mcp/flow';
import {
  explainFlowSequence,
  setSequenceLoopConfig,
  setSequenceParameterMapping,
  validateFlowSequence
} from '$lib/mcp/sequence';
import {
  explainAssertion,
  explainTemplateExpression,
  explainTransformationExpression,
  suggestTemplateExpression
} from '$lib/mcp/explain';
import type { FlowLoopConfig, FlowParameterMapping, FlowSequence } from '$lib/types/flow_sequence';
import type { TestFlow } from '$lib/types/test-flow';
import {
  createTestFlowDraft,
  commitTestFlowDraft,
  discardTestFlowDraft
} from '$lib/server/service/test_flows/draft_flow';
import {
  addStepToTestFlow,
  updateStepInTestFlow,
  type AddStepInput,
  type UpdateStepInput
} from '$lib/server/service/test_flows/edit/steps';
import { patchEndpointInTestFlow, type EndpointPatch } from '$lib/server/service/test_flows/edit/endpoint';
import {
  addFlowParameterToTestFlow,
  setFlowOutputInTestFlow,
  linkEnvironmentToTestFlow
} from '$lib/server/service/test_flows/edit/parameters';

export interface McpAuthContext {
  userId: number;
  agentTokenId?: number;
  email?: string;
  name?: string;
}

function asTextResult(structuredContent: Record<string, unknown>) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(structuredContent, null, 2)
      }
    ],
    structuredContent
  };
}

const primitiveParameterTypeSchema = z.enum(['string', 'number', 'boolean', 'null']);
const flowOutputTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'unknown'
]);
const arrayItemTypeSchema = z.enum(['string', 'number', 'boolean', 'object', 'unknown']);
const sequenceLoopSourceSchema: z.ZodTypeAny = z.object({
  id: z.string(),
  alias: z.string(),
  source_type: z.enum(['fixed_count', 'environment_variable_array', 'previous_output_array']),
  count: z.number().optional(),
  source_value: z.string().optional(),
  source_flow_step: z.number().optional(),
  source_output_field: z.string().optional()
});
const sequenceLoopDefinitionSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    sources: z.array(sequenceLoopSourceSchema),
    children: z.array(sequenceLoopDefinitionSchema).optional()
  })
);
const sequenceLoopConfigSchema = z.object({
  enabled: z.boolean(),
  root: sequenceLoopDefinitionSchema.optional()
});
const sequenceParameterMappingSchema = z.object({
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
  source_flow_step: z.number().optional(),
  source_output_field: z.string().optional(),
  loop_id: z.string().optional(),
  loop_source_id: z.string().optional()
});
const transformationExpressionDescription =
  'Pipeline-only transformation expression. Use value | fn(args...), for example $.items | count(), $.items | map({ id: $.id, total: $.price * $.qty }), $.email | contains("@company.com"), $.amount | round(2), or $.items | take({{param:limit}} | int(10)). Do not use direct function calls such as length($.items), round($.amount, 2), or contains($.email, "@"). Arguments may be JSONPath, templates, constants, object/array literals, operator expressions, or parenthesized nested pipelines.';
const transformationReference = {
  functions: {
    filtering: [
      {
        syntax: 'where(condition)',
        input: 'array',
        output: 'array',
        notes: 'Keeps items where condition is truthy. Inside condition, $ is each item.'
      },
      {
        syntax: 'select(condition)',
        input: 'array',
        output: 'array',
        notes: 'Alias of where(condition).'
      }
    ],
    mapping: [
      {
        syntax: 'map(expression)',
        input: 'array',
        output: 'array',
        notes: 'Maps each item. Inside expression, $ is each item.'
      },
      {
        syntax: 'map({ key: expression }) or map(key: expression)',
        input: 'array',
        output: 'array<object>',
        notes: 'Builds an object for each item.'
      },
      {
        syntax: 'transform(expression) or transform(key: expression)',
        input: 'object|array',
        output: 'value|array',
        notes: 'Transforms one value, or each item if input is an array.'
      }
    ],
    sortingAndSlicing: [
      {
        syntax: 'sort(by: expression, desc: boolean)',
        input: 'array',
        output: 'array',
        notes: 'Sorts items. In by, $ is each item.'
      },
      { syntax: 'take(n)', input: 'array', output: 'array', notes: 'Keeps first n items.' },
      { syntax: 'skip(n)', input: 'array', output: 'array', notes: 'Drops first n items.' },
      { syntax: 'at(index)', input: 'array', output: 'value', notes: 'Supports negative indexes.' },
      { syntax: 'first()', input: 'array', output: 'value', notes: 'Returns first item.' },
      { syntax: 'last()', input: 'array', output: 'value', notes: 'Returns last item.' }
    ],
    aggregation: [
      { syntax: 'count()', input: 'array', output: 'number', notes: 'Counts array items.' },
      {
        syntax: 'sum(expression?)',
        input: 'array',
        output: 'number',
        notes: 'Sums each item or expression evaluated per item.'
      }
    ],
    arraysAndObjects: [
      {
        syntax: 'flatten(depth?)',
        input: 'array',
        output: 'array',
        notes: 'Flattens nested arrays. Default depth is 1.'
      },
      {
        syntax: 'pick(["key"])',
        input: 'object',
        output: 'object',
        notes: 'Keeps selected object keys.'
      }
    ],
    arithmetic: [
      { syntax: 'add(value)', input: 'number', output: 'number', notes: 'Adds value.' },
      { syntax: 'sub(value)', input: 'number', output: 'number', notes: 'Subtracts value.' },
      { syntax: 'mul(value)', input: 'number', output: 'number', notes: 'Multiplies by value.' },
      { syntax: 'div(value)', input: 'number', output: 'number', notes: 'Divides by value.' },
      { syntax: 'mod(value)', input: 'number', output: 'number', notes: 'Modulo by value.' }
    ],
    casts: [
      {
        syntax: 'int(default?)',
        input: 'value',
        output: 'number|null',
        notes: 'Casts to integer.'
      },
      {
        syntax: 'float(default?)',
        input: 'value',
        output: 'number|null',
        notes: 'Casts to float.'
      },
      {
        syntax: 'string(default?)',
        input: 'value',
        output: 'string|null',
        notes: 'Casts to string.'
      },
      {
        syntax: 'bool(default?)',
        input: 'value',
        output: 'boolean|null',
        notes: 'Casts to boolean.'
      }
    ],
    value: [
      {
        syntax: 'contains(search)',
        input: 'string',
        output: 'boolean',
        notes: 'Checks whether input contains search.'
      },
      {
        syntax: 'startsWith(prefix)',
        input: 'string',
        output: 'boolean',
        notes: 'Checks string prefix.'
      },
      {
        syntax: 'endsWith(suffix)',
        input: 'string',
        output: 'boolean',
        notes: 'Checks string suffix.'
      },
      {
        syntax: 'matches(pattern)',
        input: 'string',
        output: 'boolean',
        notes: 'Checks input against a safe regex pattern.'
      },
      {
        syntax: 'empty()',
        input: 'value',
        output: 'boolean',
        notes: 'True for empty string, null, undefined, empty array, or empty object.'
      },
      {
        syntax: 'length()',
        input: 'array|string',
        output: 'number',
        notes: 'Returns array or string length; otherwise 0.'
      },
      { syntax: 'abs()', input: 'number', output: 'number', notes: 'Absolute value.' },
      {
        syntax: 'round(digits?)',
        input: 'number',
        output: 'number',
        notes: 'Rounds input, optionally to decimal digits.'
      },
      { syntax: 'ceil()', input: 'number', output: 'number', notes: 'Rounds up.' },
      { syntax: 'floor()', input: 'number', output: 'number', notes: 'Rounds down.' },
      {
        syntax: 'min(value)',
        input: 'number',
        output: 'number',
        notes: 'Smaller of input and value.'
      },
      {
        syntax: 'max(value)',
        input: 'number',
        output: 'number',
        notes: 'Larger of input and value.'
      },
      { syntax: 'pow(value)', input: 'number', output: 'number', notes: 'Raises input to value.' }
    ]
  },
  operators: {
    comparison: [
      { syntax: 'a == b', output: 'boolean' },
      { syntax: 'a != b', output: 'boolean' },
      { syntax: 'a > b', output: 'boolean' },
      { syntax: 'a < b', output: 'boolean' },
      { syntax: 'a >= b', output: 'boolean' },
      { syntax: 'a <= b', output: 'boolean' }
    ],
    logical: [
      { syntax: 'a && b', output: 'boolean' },
      { syntax: 'a || b', output: 'boolean' },
      { syntax: '!a', output: 'boolean' }
    ],
    arithmetic: [
      { syntax: 'a + b', output: 'number' },
      { syntax: 'a - b', output: 'number' },
      { syntax: 'a * b', output: 'number' },
      { syntax: 'a / b', output: 'number' },
      { syntax: 'a % b', output: 'number' }
    ]
  }
};

function getUserId(inputUserId: number | undefined, authContext?: McpAuthContext): number {
  const resolved = authContext?.userId ?? inputUserId ?? Number(process.env.TEST_PILOT_USER_ID);
  if (!resolved || Number.isNaN(resolved)) {
    throw new Error(
      'userId is required for database-backed tools. Pass userId explicitly or set TEST_PILOT_USER_ID.'
    );
  }
  return resolved;
}

function requireAuthContext(authContext?: McpAuthContext): McpAuthContext {
  if (!authContext?.userId) {
    throw new Error('Authenticated MCP user context is required for this operation.');
  }
  return authContext;
}

function extractApiIds(document: FlowDocument): number[] {
  const apiIds = new Set<number>();

  for (const step of document.flowData.steps) {
    for (const endpoint of step.endpoints) {
      const numericApiId =
        typeof endpoint.api_id === 'string' ? Number(endpoint.api_id) : endpoint.api_id;
      if (typeof numericApiId === 'number' && !Number.isNaN(numericApiId)) {
        apiIds.add(numericApiId);
      }
    }
  }

  if (apiIds.size === 0 && document.flowData.settings.api_hosts) {
    for (const key of Object.keys(document.flowData.settings.api_hosts)) {
      const numericApiId = Number(key);
      if (!Number.isNaN(numericApiId)) {
        apiIds.add(numericApiId);
      }
    }
  }

  return [...apiIds];
}

function requireApiScope(input: { apiId?: number; apiIds?: number[] }): {
  apiId?: number;
  apiIds?: number[];
} {
  if (input.apiId) {
    return { apiId: input.apiId };
  }

  if (input.apiIds && input.apiIds.length > 0) {
    return { apiIds: input.apiIds };
  }

  throw new Error(
    'Endpoint discovery requires API scope. Select a project, choose one or more API ids from that project, and pass apiIds (or apiId) before searching endpoints.'
  );
}

async function getProjectDetailForUser(projectId: number, authContext?: McpAuthContext) {
  const user = requireAuthContext(authContext);
  const { ProjectService } = await import('$lib/server/service/projects/project_service');
  const projectService = new ProjectService();
  return projectService.getProjectDetail(projectId, user.userId);
}

async function resolveApiScope(
  input: {
    apiId?: number;
    apiIds?: number[];
    projectId?: number;
  },
  authContext?: McpAuthContext
): Promise<{ apiId?: number; apiIds?: number[] }> {
  if (input.apiId || (input.apiIds && input.apiIds.length > 0)) {
    return requireApiScope({ apiId: input.apiId, apiIds: input.apiIds });
  }

  if (input.projectId) {
    const detail = await getProjectDetailForUser(input.projectId, authContext);
    if (detail.apis.length === 1) {
      return { apiIds: [detail.apis[0].apiId] };
    }
    if (detail.apis.length > 1) {
      throw new Error(
        `Project ${input.projectId} has multiple APIs (${detail.apis.map((api) => `${api.apiId}:${api.api?.name || `API ${api.apiId}`}`).join(', ')}). Ask the human which APIs to use, then pass apiIds explicitly.`
      );
    }
    // Project has no direct API links — fall back to environment-linked API IDs.
    const user = requireAuthContext(authContext);
    const { ProjectEnvironmentService } = await import(
      '$lib/server/service/projects/environment_service'
    );
    const envService = new ProjectEnvironmentService();
    const envLinks = await envService.listProjectEnvironments(input.projectId, user.userId);
    const envApiIds = [
      ...new Set(
        envLinks.environmentLinks.flatMap(
          (link) => ((link.environment?.config as { linked_apis?: number[] })?.linked_apis ?? [])
        )
      )
    ];
    if (envApiIds.length === 1) return { apiIds: envApiIds };
    if (envApiIds.length > 1) {
      throw new Error(
        `Project ${input.projectId} has multiple APIs linked via environments (${envApiIds.join(', ')}). Pass apiIds explicitly.`
      );
    }
  }

  throw new Error(
    'Endpoint discovery requires API scope. Select a project, choose one or more API ids from that project, and pass apiIds (or apiId) before searching endpoints.'
  );
}

async function buildProjectContext(
  projectId: number,
  authContext?: McpAuthContext,
  includeEnvironmentValues = true
) {
  const user = requireAuthContext(authContext);
  const { ProjectService } = await import('$lib/server/service/projects/project_service');
  const { ProjectEnvironmentService } = await import(
    '$lib/server/service/projects/environment_service'
  );
  const { ProjectEnvironmentMappingService } = await import(
    '$lib/server/service/projects/project_environment_mapping_service'
  );
  const { getTestFlowsForUser } = await import('$lib/server/service/test_flows/list_test_flows');

  const projectService = new ProjectService();
  const environmentService = new ProjectEnvironmentService();
  const environmentMappingService = new ProjectEnvironmentMappingService();

  const detail = await projectService.getProjectDetail(projectId, user.userId);
  const linkedEnvironments = await environmentService.listProjectEnvironments(
    projectId,
    user.userId
  );
  const environmentMappings = await environmentMappingService.getEnvironmentMappings(
    projectId,
    user.userId
  );
  const existingFlows = await getTestFlowsForUser(user.userId, { projectId, limit: 20, page: 1 });

  const environments = linkedEnvironments.environmentLinks.map((link) => {
    const mapping = environmentMappings.find((item) => item.environment_id === link.environmentId);
    const environmentConfig = link.environment?.config;
    return {
      id: link.environmentId,
      name: link.environment?.name ?? '',
      description: link.environment?.description,
      subEnvironments: Object.keys(environmentConfig?.environments ?? {}),
      variableDefinitions: environmentConfig?.variable_definitions ?? {},
      subEnvironmentValues: includeEnvironmentValues
        ? Object.fromEntries(
            Object.entries(environmentConfig?.environments ?? {}).map(
              ([subEnvName, subEnvConfig]) => {
                const subEnvironmentConfig = subEnvConfig as {
                  variables?: Record<string, unknown>;
                  api_hosts?: Record<string, string>;
                };
                return [
                  subEnvName,
                  {
                    variables: subEnvironmentConfig.variables ?? {},
                    apiHosts: subEnvironmentConfig.api_hosts ?? {}
                  }
                ];
              }
            )
          )
        : undefined,
      linkedApiIds: environmentConfig?.linked_apis ?? [],
      parameterMappings: mapping?.variable_mappings ?? {}
    };
  });

  // If no APIs are linked at project level, fall back to environment-linked API IDs.
  let projectApis = detail.apis.map((apiLink) => ({
    id: apiLink.apiId,
    name: apiLink.api?.name ?? '',
    description: apiLink.api?.description ?? null,
    defaultHost: apiLink.defaultHost ?? apiLink.api?.host ?? null
  }));

  if (projectApis.length === 0) {
    const envApiIds = [
      ...new Set(environments.flatMap((e) => (e.linkedApiIds as number[]) ?? []))
    ];
    if (envApiIds.length > 0) {
      const { db } = await import('$lib/server/db');
      const { apis: apisTable } = await import('$lib/server/db/schema');
      const { inArray } = await import('drizzle-orm');
      const apiRows = await db
        .select({ id: apisTable.id, name: apisTable.name, description: apisTable.description, host: apisTable.host })
        .from(apisTable)
        .where(inArray(apisTable.id, envApiIds));
      projectApis = apiRows.map((a) => ({
        id: a.id,
        name: a.name ?? '',
        description: a.description ?? null,
        defaultHost: a.host ?? null
      }));
    }
  }

  const guidanceNotes = [
    'If you are working in the backend codebase, use that context first. Read routes, controllers, services, DTOs, and recent code changes to infer the business sequence and likely endpoints before relying on endpoint search alone.',
    projectApis.length > 1
      ? 'This project has multiple APIs. Ask the human which APIs should be in scope before building or searching.'
      : projectApis.length === 1
        ? 'This project has a single linked API, so API scope can be inferred if needed.'
        : 'This project has no linked APIs.',
    environments.length > 1
      ? 'This project has multiple environments. Ask the human which environment should be linked before building.'
      : environments.length === 1
        ? 'This project has a single linked environment, so the MCP can infer it if needed.'
        : 'This project has no linked environments. The flow may need direct API Hosts configuration.'
  ];

  return {
    project: {
      id: detail.project.id,
      name: detail.project.name,
      description: detail.project.description ?? null,
      agentContext: detail.project.agentContext ?? null
    },
    apis: projectApis,
    modules: detail.modules.map((m) => ({ id: m.id, name: m.name })),
    environments,
    existingFlows: existingFlows.testFlows,
    counts: {
      apis: projectApis.length,
      environments: environments.length,
      modules: detail.modules.length,
      existingFlows: existingFlows.testFlows.length
    },
    guidance: {
      needsClarification: projectApis.length > 1 || environments.length > 1,
      reasons: [
        ...(projectApis.length > 1 ? ['multiple_apis'] : []),
        ...(environments.length > 1 ? ['multiple_environments'] : [])
      ],
      notes: guidanceNotes,
      markdown: detail.project.agentContext ?? null,
      codebaseFirstRecommendation: {
        recommended: true,
        summary:
          'If the agent can inspect the backend codebase, it should use routes, controllers, services, DTOs, and recent code changes to understand the business sequence and likely APIs before relying on endpoint discovery alone.',
        signalsToUse: [
          'routes and path definitions',
          'controllers and handlers',
          'service and repository calls',
          'request and response DTOs',
          'recent changed files and feature-specific modules'
        ]
      }
    }
  };
}

async function hydrateFlowDocumentEndpoints(document: FlowDocument): Promise<FlowDocument> {
  const existingEndpoints = document.flowData.endpoints ?? [];
  const existingIds = new Set(existingEndpoints.map((endpoint) => endpoint.id));
  const usedEndpointIds = new Set<number>();

  for (const step of document.flowData.steps) {
    for (const endpoint of step.endpoints) {
      const endpointId =
        typeof endpoint.endpoint_id === 'string'
          ? Number(endpoint.endpoint_id)
          : endpoint.endpoint_id;
      if (
        typeof endpointId === 'number' &&
        !Number.isNaN(endpointId) &&
        !existingIds.has(endpointId)
      ) {
        usedEndpointIds.add(endpointId);
      }
    }
  }

  if (usedEndpointIds.size === 0) {
    return document;
  }

  const { getEndpointsByIds } = await import('$lib/server/repository/db/test-flows');
  const fetchedEndpoints = await getEndpointsByIds([...usedEndpointIds]);
  return {
    ...document,
    flowData: {
      ...document.flowData,
      endpoints: [...existingEndpoints, ...fetchedEndpoints]
    }
  };
}

function normalizeAssertionInput(assertion: {
  id: string;
  data_source: 'response' | 'transformed_data';
  assertion_type: 'status_code' | 'response_time' | 'header' | 'json_body';
  data_id: string;
  operator: string;
  expected_value: unknown;
  enabled: boolean;
  is_template_expression?: boolean;
}): Assertion {
  if (isValidOperator(assertion.operator)) {
    return {
      ...assertion,
      operator: assertion.operator as AssertionOperator
    };
  }

  const operatorAliasMap: Record<
    string,
    { operator: AssertionOperator; expected_value?: unknown }
  > = {
    is_number: { operator: 'is_type', expected_value: 'number' },
    is_string: { operator: 'is_type', expected_value: 'string' },
    is_boolean: { operator: 'is_type', expected_value: 'boolean' },
    is_array: { operator: 'is_type', expected_value: 'array' },
    is_object: { operator: 'is_type', expected_value: 'object' }
  };

  const alias = operatorAliasMap[assertion.operator];
  if (!alias) {
    throw new Error(
      `Unknown assertion operator "${assertion.operator}". Supported operators do not include it. For type checks, use operator "is_type" with expected_value like "number".`
    );
  }

  return {
    ...assertion,
    operator: alias.operator,
    expected_value: alias.expected_value ?? assertion.expected_value
  };
}

function normalizeStepEndpoints(
  endpoints?: Array<Record<string, unknown>>
): StepEndpoint[] | undefined {
  if (!endpoints) {
    return undefined;
  }

  return endpoints.map((endpoint) => ({
    ...(endpoint as unknown as StepEndpoint),
    assertions: Array.isArray(endpoint.assertions)
      ? endpoint.assertions.map((assertion) =>
          normalizeAssertionInput(assertion as Parameters<typeof normalizeAssertionInput>[0])
        )
      : undefined
  }));
}

async function ensureFlowHasApiHosts(
  document: FlowDocument,
  authContext?: McpAuthContext
): Promise<FlowDocument> {
  const existingHosts = document.flowData?.settings?.api_hosts ?? {};
  if (Object.keys(existingHosts).length > 0) {
    return document;
  }

  const apiIds = extractApiIds(document);
  if (apiIds.length === 0) {
    return document;
  }

  const user = requireAuthContext(authContext);
  if (document.projectId) {
    const { ProjectService } = await import('$lib/server/service/projects/project_service');
    const projectService = new ProjectService();
    const detail = await projectService.getProjectDetail(document.projectId, user.userId);
    const hostEntries = detail.apis
      .filter((apiLink) => apiIds.includes(apiLink.apiId))
      .map((apiLink) => ({
        key: String(apiLink.apiId),
        host: {
          url: apiLink.defaultHost ?? apiLink.api?.host ?? '',
          name: apiLink.api?.name ?? `API ${apiLink.apiId}`
        }
      }))
      .filter((entry) => entry.host.url);
    const apiHosts = Object.fromEntries(
      hostEntries.map((entry) => [entry.key, entry.host])
    ) as Record<string, { url: string; name: string }>;

    if (Object.keys(apiHosts).length > 0) {
      return {
        ...document,
        flowData: {
          ...document.flowData,
          settings: {
            ...document.flowData.settings,
            api_hosts: apiHosts
          }
        }
      };
    }
  }

  return document;
}

async function loadSequenceFlowsForUser(
  sequence: FlowSequence,
  userId: number
): Promise<Map<number, TestFlow>> {
  const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
  const flows = new Map<number, TestFlow>();

  for (const step of sequence.sequenceConfig.steps ?? []) {
    if (flows.has(step.test_flow_id)) {
      continue;
    }

    const result = await getTestFlow(step.test_flow_id, userId);
    if (result?.testFlow) {
      flows.set(step.test_flow_id, result.testFlow as unknown as TestFlow);
    }
  }

  return flows;
}

async function environmentVariableNamesForProject(
  projectId: number,
  includeEnvironmentValues: boolean,
  authContext?: McpAuthContext
): Promise<Set<string>> {
  if (!includeEnvironmentValues) {
    return new Set();
  }

  const context = await buildProjectContext(projectId, authContext, true);
  const names = new Set<string>();
  for (const environment of context.environments) {
    for (const name of Object.keys(environment.variableDefinitions ?? {})) {
      names.add(name);
    }
    for (const subEnvironment of Object.values(environment.subEnvironmentValues ?? {})) {
      for (const name of Object.keys(subEnvironment.variables ?? {})) {
        names.add(name);
      }
    }
  }
  return names;
}

async function resolveModuleId(sequenceId: number): Promise<number> {
  const { db } = await import('$lib/server/db');
  const { flowSequences } = await import('$lib/server/db/schema');
  const { eq } = await import('drizzle-orm');
  const [row] = await db
    .select({ moduleId: flowSequences.moduleId })
    .from(flowSequences)
    .where(eq(flowSequences.id, sequenceId));
  if (!row) throw new Error(`Sequence ${sequenceId} not found.`);
  return row.moduleId;
}

async function getSequenceForMcp(
  input: {
    sequenceId: number;
    moduleId?: number;
    projectId: number;
  },
  authContext?: McpAuthContext
): Promise<FlowSequence> {
  const user = requireAuthContext(authContext);
  const moduleId = input.moduleId ?? (await resolveModuleId(input.sequenceId));
  const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
  const service = new FlowSequenceService();
  return service.getFlowSequence(input.sequenceId, moduleId, input.projectId, user.userId);
}

async function updateSequenceForMcp(
  sequence: FlowSequence,
  input: {
    moduleId?: number;
    projectId: number;
  },
  authContext?: McpAuthContext
): Promise<FlowSequence> {
  const user = requireAuthContext(authContext);
  const moduleId = input.moduleId ?? sequence.moduleId;
  const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
  const service = new FlowSequenceService();
  return service.updateSequence(sequence.id, moduleId, input.projectId, user.userId, {
    sequenceConfig: sequence.sequenceConfig
  });
}

export function createTestPilotMcpServer(authContext?: McpAuthContext): McpServer {
  const server = new McpServer({
    name: 'test-pilot-mcp',
    version: '0.1.0'
  });

  server.registerTool(
    'get_context',
    {
      title: 'Get Context',
      description:
        'Get a concise guide for how AI agents should use the Test-Pilot MCP app, including the normal flow-building workflow, key tools, and transformation syntax rules.',
      inputSchema: {
        focus: z.enum(['overview', 'flow', 'transformations']).optional()
      }
    },
    async ({ focus = 'overview' }) =>
      asTextResult({
        app: {
          name: 'Test-Pilot',
          purpose:
            'Generate, edit, validate, run, and save API test flows from imported OpenAPI/Swagger endpoints.'
        },
        conceptualModel: {
          hierarchy: [
            '1. API Endpoint — one imported HTTP call (method + path). The atomic unit.',
            '2. Test Flow — a linear chain of API endpoint calls with typed input parameters, assertions, and named outputs. Designed to be self-contained and reusable across multiple sequences.',
            '3. Test Sequence — a chain of test flows. Wires flows together by mapping one flow\'s output to the next flow\'s input parameters. Business scenarios live here.',
            '4. Project Module — a grouping container for test sequences, like a folder. No business logic — purely organizational.'
          ],
          dataFlowDirection: 'Endpoints → Flows → Sequences. Data flows in one direction: endpoint responses feed flow outputs; flow outputs feed sequence parameter mappings.',
          reuseContract: 'Flows are built to be reusable. The same flow can appear in many sequences with different parameter values. Put reusable logic in flows; put scenario-specific wiring in sequences.',
          moduleNote: 'moduleId is required by sequence tools but carries no business meaning — it is just the folder a sequence lives in. Retrieve it once from get_project_context (modules array) and reuse. When a project has only one module, that is the moduleId for all sequences.'
        },
        agentWorkflow: [
          'Call prepare_flow_context(projectId) to inspect APIs, environments, and existing flows.',
          'If guidance says clarification is needed, ask the human to choose APIs and/or environment first.',
          'PATH A — Create a new flow: use save_flow(flowDocument) with a full JSON definition. save_flow is a one-shot create; it does not support incremental editing.',
          'PATH B — Edit an existing flow: use create_flow_draft(flowId) to clone it as a DB-backed draft, then edit the draft incrementally.',
          'Build steps with add_step(draftFlowId, ...) — include full endpoint definitions including body, headers, assertions, and transformations in one call.',
          'For surgical edits to an existing endpoint, use update_endpoint(draftFlowId, stepId, index, patch).',
          'Validate and test with validate_flow(draftFlowId) and run_flow(draftFlowId).',
          'Commit with commit_flow_draft(draftFlowId) to overwrite the original, or pass saveAsNew: true to create a new flow. Discard with discard_flow_draft to cancel.'
        ],
        keyTools: {
          context: ['prepare_flow_context', 'get_project_context', 'list_test_flows', 'get_test_flow'],
          endpointDiscovery: ['search_endpoints', 'browse_endpoints', 'get_endpoint_details'],
          drafting: [
            'create_flow_draft',
            'add_step',
            'update_step',
            'update_endpoint',
            'commit_flow_draft',
            'discard_flow_draft'
          ],
          dataDependencies: ['suggest_expression', 'explain_expression'],
          validation: ['validate_flow', 'explain_flow'],
          execution: ['run_flow', 'save_flow'],
          coverage: ['get_coverage_gaps', 'explain_sequence', 'browse_endpoints', 'validate_flow_sequence'],
          modules: ['create_module', 'update_module'],
          sequences: ['create_sequence', 'update_sequence', 'delete_sequence', 'clone_sequence']
        },
        coverageWorkflow: [
          '1. list_projects → get_project_context(projectId) — get module IDs, API IDs, and existing flows.',
          '2. get_coverage_gaps(projectId) — see unusedFlows, flowCoverage (flow→sequence map, deduped), and endpointCoverage (coveredEndpoints, uncoveredEndpoints, coverageByTag).',
          '3. browse_endpoints(projectId, tag: "...") — drill into uncovered endpoint groups by tag.',
          '4. explain_sequence(projectId, moduleId, sequenceId) — understand how a sequence composes its flows and what parameters it needs.',
          '5. validate_flow_sequence(projectId, moduleId, sequenceId) — check for missing parameter mappings or broken output references.'
        ],
        transformationSyntax:
          focus === 'overview' || focus === 'transformations'
            ? {
                rule: 'Transformation functions are pipeline stages only: value | fn(args...). Do not use fn(value, args).',
                validExamples: [
                  '$.items | count()',
                  '$.items | map({ id: $.id, total: $.price * $.qty })',
                  '$.email | contains("@company.com")',
                  '$.amount | round(2)',
                  '$.items | take({{param:limit}} | int(10))'
                ],
                invalidExamples: [
                  'length($.items)',
                  'round($.amount, 2)',
                  'contains($.email, "@company.com")'
                ],
                inputs:
                  'Function args may be JSONPath, {{param/res/proc/func}} templates, constants, arrays, objects, operator expressions, or parenthesized nested pipelines.',
                templates:
                  'Transformations allow {{param:...}}, {{res:...}}, {{proc:...}}, and {{func:...}}. Do not use {{env:...}} or {{{...}}} in transformations.'
              }
            : null,
        transformationReference:
          focus === 'overview' || focus === 'transformations' ? transformationReference : null,
        templateRules: {
          parameters: 'Use {{param:name}} for flow inputs.',
          responses: 'Use {{res:stepId-0.$.path}} for previous endpoint responses.',
          transformations: 'Use {{proc:stepId-0.$.alias.path}} for transformation outputs.',
          environment:
            'Do not reference environment values directly in flows. Add a flow parameter, then map it to an environment variable.',
          typePreservation: [
            'Use DOUBLE braces {{...}} everywhere: path params, query params, headers, and string-valued body fields.',
            'Use TRIPLE braces {{{...}}} ONLY inside a JSON request body when the field must stay a non-string primitive (number, boolean, null).',
            'Example — body where conversation_id is an integer: { "conversation_id": {{{param:conversation_id}}} }',
            'Example — query param (always string context, so double): queryParams: { "conversation_id": "{{param:conversation_id}}" }',
            'A common mistake: using {{{...}}} for integers in query params or path params. Those are always rendered as strings in URLs — use double braces there.'
          ]
        },
        focus
      })
  );

  server.registerTool(
    'explain_expression',
    {
      title: 'Explain Expression',
      description: 'Explain a Test-Pilot template, transformation, or assertion in plain English.',
      inputSchema: {
        kind: z.enum(['template', 'transformation', 'assertion']),
        expression: z.string().optional(),
        assertion: z
          .object({
            id: z.string(),
            data_source: z.enum(['response', 'transformed_data']),
            assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
            data_id: z.string(),
            operator: z.string(),
            expected_value: z.unknown(),
            enabled: z.boolean(),
            is_template_expression: z.boolean().optional()
          })
          .optional()
      }
    },
    async ({ kind, expression, assertion }) => {
      if (kind === 'assertion') {
        if (!assertion) throw new Error('assertion is required when kind=assertion');
        return asTextResult({ explanation: explainAssertion(normalizeAssertionInput(assertion)) });
      }

      if (!expression) {
        throw new Error('expression is required for template and transformation explanations');
      }

      const explanation =
        kind === 'template'
          ? explainTemplateExpression(expression)
          : explainTransformationExpression(expression);

      return asTextResult({ explanation });
    }
  );

  server.registerTool(
    'suggest_expression',
    {
      title: 'Suggest Expression',
      description:
        'Build canonical Test-Pilot template syntax from structured input and explain it.',
      inputSchema: {
        source: z.enum(['res', 'proc', 'param', 'func']),
        preserveType: z.boolean().optional(),
        stepEndpointRef: z.string().optional(),
        endpointIndex: z.number().optional(),
        jsonPath: z.string().optional(),
        alias: z.string().optional(),
        nestedPath: z.string().optional(),
        parameterName: z.string().optional(),
        functionName: z.string().optional(),
        functionArgs: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
      }
    },
    async (input) =>
      asTextResult(suggestTemplateExpression(input) as unknown as Record<string, unknown>)
  );

  server.registerTool(
    'prepare_flow_context',
    {
      title: 'Prepare Flow Context',
      description:
        'Gather the project APIs, environments, environment values, and existing flows before starting a V2 flow session. If you can inspect the backend codebase, use that context to understand the business flow, endpoint sequence, and likely APIs before relying on search alone. If guidance.needsClarification is true, the agent should ask the human to choose APIs and/or environment first.',
      inputSchema: {
        projectId: z.number(),
        includeEnvironmentValues: z.boolean().optional()
      }
    },
    async ({ projectId, includeEnvironmentValues = true }) =>
      asTextResult(await buildProjectContext(projectId, authContext, includeEnvironmentValues))
  );

  server.registerTool(
    'create_flow_draft',
    {
      title: 'Create Flow Draft',
      description:
        'Clone an existing test flow as a DB-backed draft so it can be edited step by step. Returns draftFlowId — use that id for all subsequent editing calls (add_step, update_step, update_endpoint, validate_flow, run_flow). Commit changes back to the original with commit_flow_draft, or discard with discard_flow_draft.',
      inputSchema: {
        flowId: z.number()
      }
    },
    async ({ flowId }) => {
      const user = requireAuthContext(authContext);
      const result = await createTestFlowDraft(flowId, user.userId);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const draft = await getTestFlow(result.draftFlowId, user.userId);
      return asTextResult({
        draftFlowId: result.draftFlowId,
        originalFlowId: result.originalFlowId,
        flow: draft?.testFlow ?? null,
        warning: `commit_flow_draft will OVERWRITE flow ${result.originalFlowId} in place. Use saveAsNew: true on commit_flow_draft to save as a separate new flow instead.`,
        note: 'Use draftFlowId for all edits. Call commit_flow_draft when done or discard_flow_draft to cancel.'
      });
    }
  );

  server.registerTool(
    'commit_flow_draft',
    {
      title: 'Commit Flow Draft',
      description:
        'Commit a draft flow. By default (saveAsNew: false) overwrites the original flow in place and deletes the draft — use this to update an existing flow. Set saveAsNew: true to save the draft as a brand-new independent flow instead, leaving the original untouched.',
      inputSchema: {
        draftFlowId: z.number(),
        saveAsNew: z.boolean().optional(),
        newName: z.string().optional()
      }
    },
    async ({ draftFlowId, saveAsNew = false, newName }) => {
      const user = requireAuthContext(authContext);

      if (saveAsNew) {
        const { db } = await import('$lib/server/db');
        const { testFlows } = await import('$lib/server/db/schema');
        const { and, eq } = await import('drizzle-orm');
        const { getTestFlowApiIds } = await import(
          '$lib/server/repository/db/test-flows'
        );
        const { createBasicTestFlow } = await import(
          '$lib/server/service/test_flows/create_test_flow'
        );

        const [draft] = await db
          .select()
          .from(testFlows)
          .where(and(eq(testFlows.id, draftFlowId), eq(testFlows.userId, user.userId)));
        if (!draft) throw new Error('Draft flow not found or does not belong to the user');
        if (!draft.draftOf) throw new Error(`Flow ${draftFlowId} is not a draft`);

        const apiIds = await getTestFlowApiIds(draftFlowId);
        const created = await createBasicTestFlow(user.userId, {
          name: newName ?? `${draft.name} (copy)`,
          description: draft.description ?? undefined,
          apiIds,
          projectId: draft.projectId ?? undefined,
          environmentId: draft.environmentId ?? undefined,
          flowJson: draft.flowJson
        });

        const { discardTestFlowDraft } = await import(
          '$lib/server/service/test_flows/draft_flow'
        );
        await discardTestFlowDraft(draftFlowId, user.userId);

        return asTextResult({
          committed: true,
          saveAsNew: true,
          flowId: created.testFlow.id,
          name: created.testFlow.name,
          note: 'Draft discarded. A new independent flow was created — the original flow was not modified.'
        });
      }

      const result = await commitTestFlowDraft(draftFlowId, user.userId);
      return asTextResult({
        committed: true,
        saveAsNew: false,
        flowId: result.id,
        name: result.name,
        note: `Original flow ${result.id} has been overwritten with the draft content.`
      });
    }
  );

  server.registerTool(
    'discard_flow_draft',
    {
      title: 'Discard Flow Draft',
      description: 'Delete the draft flow without touching the original.',
      inputSchema: {
        draftFlowId: z.number()
      }
    },
    async ({ draftFlowId }) => {
      const user = requireAuthContext(authContext);
      await discardTestFlowDraft(draftFlowId, user.userId);
      return asTextResult({ discarded: true, draftFlowId });
    }
  );

  server.registerTool(
    'add_step',
    {
      title: 'Add Step',
      description:
        'Append a step to a DB-backed draft flow. Include full endpoint definitions — body, headers, queryParams, pathParams, assertions, and transformations — in the initial call to minimise roundtrips. Each step can contain multiple endpoints, which execute in parallel.',
      inputSchema: {
        flowId: z.number(),
        step_id: z.string().optional(),
        label: z.string(),
        endpoints: z
          .array(
            z.object({
              endpoint_id: z.union([z.string(), z.number()]),
              api_id: z.union([z.string(), z.number()]),
              order: z.number().optional(),
              pathParams: z.record(z.string(), z.string()).optional(),
              queryParams: z
                .record(z.string(), z.union([z.string(), z.array(z.string())]))
                .optional(),
              body: z.unknown().optional(),
              headers: z
                .array(
                  z.object({
                    name: z.string(),
                    value: z.string(),
                    enabled: z.boolean()
                  })
                )
                .optional(),
              transformations: z
                .array(
                  z.object({
                    alias: z.string(),
                    expression: z.string().describe(transformationExpressionDescription)
                  })
                )
                .optional(),
              assertions: z
                .array(
                  z.object({
                    id: z.string(),
                    data_source: z.enum(['response', 'transformed_data']),
                    assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
                    data_id: z.string(),
                    operator: z.string(),
                    expected_value: z.unknown(),
                    enabled: z.boolean(),
                    is_template_expression: z.boolean().optional()
                  })
                )
                .optional(),
              skipDefaultStatusCheck: z.boolean().optional()
            })
          )
          .optional(),
        timeout: z.number().optional(),
        clearCookiesBeforeExecution: z.boolean().optional()
      }
    },
    async ({ flowId, ...stepInput }) => {
      const user = requireAuthContext(authContext);
      const input: AddStepInput = {
        ...stepInput,
        endpoints: normalizeStepEndpoints(
          stepInput.endpoints as unknown as Array<Record<string, unknown>> | undefined
        )
      };
      const updated = await addStepToTestFlow(flowId, user.userId, input);
      return asTextResult({ flowId, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'update_step',
    {
      title: 'Update Step',
      description:
        'Update step-level metadata (label, timeout, clearCookiesBeforeExecution) on a DB-backed draft. For endpoint content changes, use update_endpoint instead.',
      inputSchema: {
        flowId: z.number(),
        stepId: z.string(),
        label: z.string().optional(),
        timeout: z.number().optional(),
        clearCookiesBeforeExecution: z.boolean().optional()
      }
    },
    async ({ flowId, stepId, ...stepInput }) => {
      const user = requireAuthContext(authContext);
      const input: UpdateStepInput = stepInput;
      const updated = await updateStepInTestFlow(flowId, user.userId, stepId, input);
      return asTextResult({ flowId, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'update_endpoint',
    {
      title: 'Update Endpoint',
      description:
        'Surgically patch one endpoint within a step on a DB-backed draft. Body fields are deep-merged (existing fields not in the patch are preserved). Headers are merged by name (case-insensitive). queryParams and pathParams are merged by key. assertions and transformations replace the full array.',
      inputSchema: {
        flowId: z.number(),
        stepId: z.string(),
        endpointIndex: z.number().default(0),
        patch: z.object({
          body: z.record(z.string(), z.unknown()).optional(),
          headers: z
            .array(z.object({ name: z.string(), value: z.string(), enabled: z.boolean().optional() }))
            .optional(),
          queryParams: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
          pathParams: z.record(z.string(), z.string()).optional(),
          assertions: z
            .array(
              z.object({
                id: z.string(),
                data_source: z.enum(['response', 'transformed_data']),
                assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
                data_id: z.string(),
                operator: z.string(),
                expected_value: z.unknown(),
                enabled: z.boolean(),
                is_template_expression: z.boolean().optional()
              })
            )
            .optional(),
          transformations: z
            .array(
              z.object({
                alias: z.string(),
                expression: z.string().describe(transformationExpressionDescription)
              })
            )
            .optional(),
          skipDefaultStatusCheck: z.boolean().optional()
        })
      }
    },
    async ({ flowId, stepId, endpointIndex, patch }) => {
      const user = requireAuthContext(authContext);
      const normalizedPatch: EndpointPatch = {
        ...patch,
        assertions: patch.assertions
          ? patch.assertions.map((a) => normalizeAssertionInput(a as Parameters<typeof normalizeAssertionInput>[0]))
          : undefined
      };
      const updated = await patchEndpointInTestFlow(flowId, user.userId, stepId, endpointIndex, normalizedPatch);
      return asTextResult({ flowId, stepId, endpointIndex, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'add_flow_parameter',
    {
      title: 'Add Flow Parameter',
      description:
        'Add or update a primitive flow input parameter on a DB-backed draft. Environment values should enter a standalone flow by mapping an environment variable to one of these parameters.',
      inputSchema: {
        flowId: z.number(),
        parameter: z.object({
          name: z.string(),
          type: primitiveParameterTypeSchema,
          value: z.unknown().optional(),
          defaultValue: z.unknown().optional(),
          description: z.string().optional(),
          required: z.boolean()
        })
      }
    },
    async ({ flowId, parameter }) => {
      const user = requireAuthContext(authContext);
      const updated = await addFlowParameterToTestFlow(flowId, user.userId, parameter);
      return asTextResult({ flowId, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'set_flow_output',
    {
      title: 'Set Flow Output',
      description:
        'Add or update a flow output on a DB-backed draft. For array outputs, set arrayItemType; sequence loop mode can use only string, number, or boolean arrays.',
      inputSchema: {
        flowId: z.number(),
        output: z.object({
          name: z.string(),
          description: z.string().optional(),
          value: z.string(),
          isTemplate: z.boolean().optional(),
          type: flowOutputTypeSchema.optional(),
          arrayItemType: arrayItemTypeSchema.optional(),
          castToType: z.boolean().optional()
        })
      }
    },
    async ({ flowId, output }) => {
      const user = requireAuthContext(authContext);
      const updated = await setFlowOutputInTestFlow(flowId, user.userId, output);
      return asTextResult({ flowId, output, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'link_environment_to_flow',
    {
      title: 'Link Environment To Flow',
      description:
        'Link a project environment to a DB-backed draft and map environment variables to flow parameters.',
      inputSchema: {
        flowId: z.number(),
        environmentId: z.number(),
        environmentName: z.string(),
        selectedSubEnvironment: z.string().optional(),
        parameterMappings: z.record(z.string(), z.string()).optional()
      }
    },
    async ({ flowId, environmentId, environmentName, selectedSubEnvironment, parameterMappings }) => {
      const user = requireAuthContext(authContext);
      const updated = await linkEnvironmentToTestFlow(flowId, user.userId, {
        environmentId,
        environmentName,
        selectedSubEnvironment,
        parameterMappings
      });
      return asTextResult({ flowId, environmentId, flowJson: updated.flowJson });
    }
  );

  server.registerTool(
    'validate_flow',
    {
      title: 'Validate Flow',
      description:
        'Validate structure, template references, and common expression risks for a saved or draft flow.',
      inputSchema: {
        flowId: z.number()
      }
    },
    async ({ flowId }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const result = await getTestFlow(flowId, user.userId);
      if (!result) throw new Error(`Test flow ${flowId} was not found.`);
      const flowDocument: FlowDocument = {
        name: result.testFlow.name,
        flowData: {
          ...result.testFlow.flowJson,
          endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
        }
      };
      const validation = validateFlowDocument(flowDocument);
      return asTextResult({ flowId, ...validation });
    }
  );

  server.registerTool(
    'explain_flow',
    {
      title: 'Explain Flow',
      description:
        'Explain a saved or draft flow step-by-step, including data dependencies and warnings. Flows are user-global — scoped to the authenticated user, not a project. Only flowId is used; any projectId passed is ignored.',
      inputSchema: {
        flowId: z.number()
      }
    },
    async ({ flowId }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const result = await getTestFlow(flowId, user.userId);
      if (!result) throw new Error(`Test flow ${flowId} was not found.`);
      const flowDocument: FlowDocument = {
        name: result.testFlow.name,
        flowData: {
          ...result.testFlow.flowJson,
          endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
        }
      };
      const explanation = explainFlowDocument(flowDocument);
      return asTextResult({ flowId, ...explanation });
    }
  );

  server.registerTool(
    'run_flow',
    {
      title: 'Run Flow',
      description:
        'Run a saved or draft test flow by its database id using the FlowRunner engine and return full results inline.',
      inputSchema: {
        flowId: z.number(),
        parameterOverrides: z.record(z.string(), z.unknown()).optional(),
        environmentOverrides: z
          .object({
            environmentId: z.number().optional(),
            subEnvironment: z.string().optional()
          })
          .optional(),
        preferences: z
          .object({
            parallelExecution: z.boolean().optional(),
            stopOnError: z.boolean().optional(),
            serverCookieHandling: z.boolean().optional(),
            retryCount: z.number().optional(),
            timeout: z.number().optional()
          })
          .optional()
      }
    },
    async ({ flowId, parameterOverrides, environmentOverrides, preferences }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const result = await getTestFlow(flowId, user.userId);
      if (!result) throw new Error(`Test flow ${flowId} was not found.`);

      let sourceDocument: FlowDocument = {
        name: result.testFlow.name,
        description: result.testFlow.description ?? undefined,
        projectId: result.testFlow.projectId ?? undefined,
        environmentId: result.testFlow.environmentId ?? undefined,
        flowData: {
          ...result.testFlow.flowJson,
          endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
        }
      };

      let runnableDocument = await ensureFlowHasApiHosts(sourceDocument, authContext);
      if (parameterOverrides && Object.keys(parameterOverrides).length > 0) {
        runnableDocument = {
          ...runnableDocument,
          flowData: {
            ...runnableDocument.flowData,
            parameters: runnableDocument.flowData.parameters.map((parameter) =>
              Object.prototype.hasOwnProperty.call(parameterOverrides, parameter.name)
                ? { ...parameter, defaultValue: parameterOverrides[parameter.name] }
                : parameter
            )
          }
        };
      }
      const validation = validateFlowDocument(runnableDocument);
      if (!validation.valid) {
        throw new Error(`Flow is not valid and cannot run: ${validation.errors.join('; ')}`);
      }

      const effectiveDocument =
        environmentOverrides?.environmentId !== undefined ||
        environmentOverrides?.subEnvironment !== undefined
          ? {
              ...runnableDocument,
              environmentId: environmentOverrides?.environmentId ?? runnableDocument.environmentId,
              flowData: {
                ...runnableDocument.flowData,
                settings: {
                  ...runnableDocument.flowData.settings,
                  environment: {
                    environmentId:
                      environmentOverrides?.environmentId ??
                      runnableDocument.flowData.settings.environment?.environmentId ??
                      runnableDocument.flowData.settings.linkedEnvironment?.environmentId ??
                      null,
                    subEnvironment:
                      environmentOverrides?.subEnvironment ??
                      runnableDocument.flowData.settings.environment?.subEnvironment ??
                      null
                  },
                  linkedEnvironment: runnableDocument.flowData.settings.linkedEnvironment
                    ? {
                        ...runnableDocument.flowData.settings.linkedEnvironment,
                        environmentId:
                          environmentOverrides?.environmentId ??
                          runnableDocument.flowData.settings.linkedEnvironment.environmentId
                      }
                    : runnableDocument.flowData.settings.linkedEnvironment
                }
              }
            }
          : runnableDocument;

      const { runFlowDataSync } = await import(
        '$lib/server/service/test_flows/run_test_flow_sync'
      );

      const syncResult = await runFlowDataSync(
        effectiveDocument.flowData,
        user.userId,
        {
          parameters: parameterOverrides,
          environment: environmentOverrides,
          preferences: {
            parallelExecution: preferences?.parallelExecution ?? false,
            stopOnError: preferences?.stopOnError ?? true,
            serverCookieHandling: preferences?.serverCookieHandling ?? false,
            retryCount: preferences?.retryCount ?? 0,
            timeout: preferences?.timeout ?? 30000
          }
        },
        {
          projectId: effectiveDocument.projectId ?? null,
          savedEnvironmentId:
            effectiveDocument.environmentId ??
            effectiveDocument.flowData.settings.environment?.environmentId ??
            null
        }
      );

      return asTextResult({
        status: syncResult.status,
        success: syncResult.success,
        summary: syncResult.summary,
        validation,
        resolvedEnvironment: {
          environmentId:
            effectiveDocument.environmentId ??
            effectiveDocument.flowData.settings.environment?.environmentId ??
            null,
          subEnvironment: effectiveDocument.flowData.settings.environment?.subEnvironment ?? null
        },
        missingParameters: syncResult.missingParameters ?? [],
        flowOutputs: syncResult.flowOutputs,
        executionState: syncResult.executionState,
        logs: syncResult.logs,
        storedResponses: syncResult.storedResponses
      });
    }
  );

  server.registerTool(
    'save_flow',
    {
      title: 'Save Flow',
      description: [
        'Persist a brand-new flow to the database from a full JSON definition.',
        'To edit an existing flow incrementally, use create_flow_draft → add_step / update_endpoint → commit_flow_draft instead.',
        '',
        'flowDocument shape:',
        '  { name, description?, projectId?, environmentId?,',
        '    flowData: {',
        '      steps: [{ step_id, label, endpoints: [...], timeout?, clearCookiesBeforeExecution? }],',
        '      parameters: [{ name, type, required, description? }],',
        '      outputs: [],',
        '      endpoints: [],   // leave empty — populated automatically',
        '      settings: { api_hosts: {}, linkedEnvironment?: { environmentId, environmentName } }',
        '    }',
        '  }',
        'Each endpoint inside steps needs: endpoint_id, api_id, order, body?, headers?, queryParams?, pathParams?, assertions?, transformations?'
      ].join('\n'),
      inputSchema: {
        flowDocument: z.object({
          name: z.string(),
          description: z.string().optional(),
          projectId: z.number().optional(),
          environmentId: z.number().optional(),
          sourceFlowId: z.number().optional(),
          flowData: z.object({
            steps: z.array(z.unknown()),
            parameters: z.array(z.unknown()).optional(),
            outputs: z.array(z.unknown()).optional(),
            endpoints: z.array(z.unknown()).optional(),
            settings: z.object({
              api_hosts: z.record(z.string(), z.unknown()).optional(),
              environment: z.object({ environmentId: z.number(), subEnvironment: z.string().optional() }).optional(),
              linkedEnvironment: z.unknown().optional()
            }).optional()
          }).optional()
        }),
        flowId: z.number().optional(),
        projectId: z.number().optional(),
        saveMode: z.enum(['auto', 'update', 'create_new']).optional()
      }
    },
    async ({ flowDocument, flowId, projectId, saveMode = 'auto' }) => {
      // Normalize: agents sometimes pass a bare TestFlowData without the FlowDocument wrapper.
      // If there's no flowData key but there is a steps key, wrap it.
      let normalizedDoc = flowDocument as FlowDocument;
      if (!normalizedDoc.flowData && (normalizedDoc as unknown as Record<string, unknown>).steps) {
        const bare = normalizedDoc as unknown as Record<string, unknown>;
        normalizedDoc = {
          name: (bare.name as string) ?? 'Untitled',
          flowData: normalizedDoc as unknown as import('$lib/components/test-flows/types').TestFlowData
        };
      }
      if (normalizedDoc.flowData && !normalizedDoc.flowData.settings) {
        normalizedDoc = {
          ...normalizedDoc,
          flowData: { ...normalizedDoc.flowData, settings: {} as import('$lib/components/test-flows/types').TestFlowData['settings'] }
        };
      }
      const runnableDocument = await ensureFlowHasApiHosts(normalizedDoc, authContext);
      const validation = validateFlowDocument(runnableDocument);
      if (!validation.valid) {
        throw new Error(`Flow is not valid and cannot be saved: ${validation.errors.join('; ')}`);
      }

      const apiIds = extractApiIds(runnableDocument);
      if (apiIds.length === 0) {
        throw new Error(
          'Could not determine any API ids from the flow. Add endpoints before saving.'
        );
      }

      const { createBasicTestFlow } = await import(
        '$lib/server/service/test_flows/create_test_flow'
      );
      const { updateTestFlow } = await import('$lib/server/service/test_flows/update_test_flow');
      const user = requireAuthContext(authContext);
      const resolvedProjectId = projectId ?? runnableDocument.projectId;
      const resolvedEnvironmentId =
        runnableDocument.environmentId ??
        runnableDocument.flowData.settings.environment?.environmentId ??
        runnableDocument.flowData.settings.linkedEnvironment?.environmentId;
      const targetFlowId = flowId ?? runnableDocument.sourceFlowId;
      const shouldUpdate =
        saveMode === 'update' || (saveMode === 'auto' && targetFlowId !== undefined);
      const result = shouldUpdate
        ? await updateTestFlow(targetFlowId!, user.userId, {
            name: runnableDocument.name,
            description: runnableDocument.description,
            apiIds,
            projectId: resolvedProjectId,
            environmentId: resolvedEnvironmentId ?? undefined,
            flowJson: runnableDocument.flowData
          })
        : await createBasicTestFlow(user.userId, {
            name: runnableDocument.name,
            description: runnableDocument.description,
            apiIds,
            projectId: resolvedProjectId,
            environmentId: resolvedEnvironmentId ?? undefined,
            flowJson: runnableDocument.flowData
          });

      if (!result) {
        throw new Error(
          shouldUpdate
            ? `Test flow ${targetFlowId} could not be updated.`
            : 'The test flow could not be saved.'
        );
      }

      const explanation = explainFlowDocument(runnableDocument);

      return asTextResult({
        saveMode: shouldUpdate ? 'updated_existing' : 'created_new',
        flowId: result.testFlow.id,
        validation,
        explanation,
        projectId: resolvedProjectId ?? null,
        environmentId: resolvedEnvironmentId ?? null,
        testFlow: result.testFlow
      });
    }
  );

  server.registerTool(
    'list_flow_sequences',
    {
      title: 'List Flow Sequences',
      description:
        'List flow sequences for a project or module. Returns a lightweight summary by default (id, name, stepCount, flowIds, updatedAt). Pass includeFull: true to include the raw sequenceConfig — only do this when you need parameter mappings or loop config.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        includeFull: z.boolean().optional()
      }
    },
    async ({ projectId, moduleId, includeFull = false }) => {
      const user = requireAuthContext(authContext);
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const result = moduleId
        ? await service.listModuleSequences(moduleId, projectId, user.userId)
        : await service.listProjectSequences(projectId, user.userId);

      if (includeFull) {
        return asTextResult(result as unknown as Record<string, unknown>);
      }

      // Resolve module names and flow names with two lightweight parallel queries
      const { db } = await import('$lib/server/db');
      const { projectModules: modulesTable, testFlows: testFlowsTable } = await import('$lib/server/db/schema');
      const { inArray } = await import('drizzle-orm');

      const moduleIds = [...new Set(result.sequences.map((seq) => seq.moduleId))];
      const allFlowIds = [...new Set(
        result.sequences.flatMap((seq) => (seq.sequenceConfig.steps ?? []).map((s) => s.test_flow_id))
      )];

      const [moduleRows, flowRows] = await Promise.all([
        moduleIds.length > 0
          ? db.select({ id: modulesTable.id, name: modulesTable.name }).from(modulesTable).where(inArray(modulesTable.id, moduleIds))
          : Promise.resolve([]),
        allFlowIds.length > 0
          ? db.select({ id: testFlowsTable.id, name: testFlowsTable.name }).from(testFlowsTable).where(inArray(testFlowsTable.id, allFlowIds))
          : Promise.resolve([])
      ]);

      const moduleNameById = Object.fromEntries(moduleRows.map((m) => [m.id, m.name ?? '']));
      const flowNameById = Object.fromEntries(flowRows.map((f) => [f.id, f.name ?? '']));

      const summary = result.sequences.map((seq) => ({
        id: seq.id,
        name: seq.name,
        description: seq.description ?? null,
        moduleId: seq.moduleId,
        moduleName: moduleNameById[seq.moduleId] ?? null,
        stepCount: seq.sequenceConfig.steps?.length ?? 0,
        flows: (seq.sequenceConfig.steps ?? []).map((s) => ({
          id: s.test_flow_id,
          name: flowNameById[s.test_flow_id] ?? null
        })),
        updatedAt: seq.updatedAt
      }));
      return asTextResult({ sequences: summary, total: result.total });
    }
  );

  server.registerTool(
    'get_coverage_gaps',
    {
      title: 'Get Coverage Gaps',
      description: [
        'Answer three coverage questions for a project:',
        '1. Which flows are never referenced by any sequence? (unusedFlows)',
        '2. Which flows are used in which sequences? (flowCoverage)',
        '3. Which imported API endpoints are not hit by any test flow? (uncoveredEndpoints)'
      ].join(' '),
      inputSchema: {
        projectId: z.number()
      }
    },
    async ({ projectId }) => {
      const user = requireAuthContext(authContext);

      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const { browseEndpoints } = await import('$lib/server/repository/db/api-endpoints');
      const { db } = await import('$lib/server/db');
      const { testFlows: testFlowsTable } = await import('$lib/server/db/schema');
      const { eq: dbEq } = await import('drizzle-orm');

      // Fetch all flows with flowJson for endpoint scanning (up to 200)
      const flows = await db
        .select({ id: testFlowsTable.id, name: testFlowsTable.name, flowJson: testFlowsTable.flowJson })
        .from(testFlowsTable)
        .where(dbEq(testFlowsTable.projectId, projectId))
        .limit(200);

      // Fetch all sequences
      const seqService = new FlowSequenceService();
      const seqResult = await seqService.listProjectSequences(projectId, user.userId);

      // Build flow → sequence mapping, deduped: sequenceId → { name, stepCount }
      const flowToSeqMap: Record<number, Record<number, { name: string; stepCount: number }>> = {};
      for (const seq of seqResult.sequences) {
        for (const step of seq.sequenceConfig.steps ?? []) {
          if (!flowToSeqMap[step.test_flow_id]) flowToSeqMap[step.test_flow_id] = {};
          const entry = flowToSeqMap[step.test_flow_id][seq.id];
          if (entry) {
            entry.stepCount++;
          } else {
            flowToSeqMap[step.test_flow_id][seq.id] = { name: seq.name, stepCount: 1 };
          }
        }
      }

      const unusedFlows = flows
        .filter((f) => !flowToSeqMap[f.id] || Object.keys(flowToSeqMap[f.id]).length === 0)
        .map((f) => ({ id: f.id, name: f.name }));

      const flowCoverage = flows.map((f) => ({
        id: f.id,
        name: f.name,
        usedInSequences: Object.entries(flowToSeqMap[f.id] ?? {}).map(([seqId, info]) => ({
          sequenceId: Number(seqId),
          sequenceName: info.name,
          stepCount: info.stepCount
        }))
      }));

      // Collect all endpoint_ids used across all flows
      const usedEndpointIds = new Set<number>();
      for (const flow of flows) {
        const flowData = flow.flowJson as { steps?: Array<{ endpoints?: Array<{ endpoint_id?: number | string }> }> };
        for (const step of flowData?.steps ?? []) {
          for (const ep of step.endpoints ?? []) {
            if (ep.endpoint_id != null) usedEndpointIds.add(Number(ep.endpoint_id));
          }
        }
      }

      // Resolve API IDs for the project (reuse resolveApiScope logic)
      let apiIds: number[] = [];
      try {
        const scope = await resolveApiScope({ projectId }, authContext);
        apiIds = scope.apiIds ?? (scope.apiId ? [scope.apiId] : []);
      } catch {
        // No APIs linked — endpoint coverage not available
      }

      let allEndpoints: Awaited<ReturnType<typeof browseEndpoints>> = [];
      let coveredEndpoints: Array<{ id: number; method: string; path: string; summary: string | null }> = [];
      let uncoveredEndpoints: Array<{ id: number; method: string; path: string; summary: string | null }> = [];
      let coverageByTag: Array<{ tag: string; total: number; covered: number }> = [];
      if (apiIds.length > 0) {
        allEndpoints = await browseEndpoints({ userId: user.userId, apiIds, limit: 1000 });
        coveredEndpoints = allEndpoints
          .filter((ep) => usedEndpointIds.has(ep.id))
          .map((ep) => ({ id: ep.id, method: ep.method, path: ep.path, summary: ep.summary ?? null }));
        uncoveredEndpoints = allEndpoints
          .filter((ep) => !usedEndpointIds.has(ep.id))
          .map((ep) => ({ id: ep.id, method: ep.method, path: ep.path, summary: ep.summary ?? null }));
        const tagMap: Record<string, { total: number; covered: number }> = {};
        for (const ep of allEndpoints) {
          for (const tag of ep.tags ?? []) {
            if (!tagMap[tag]) tagMap[tag] = { total: 0, covered: 0 };
            tagMap[tag].total++;
            if (usedEndpointIds.has(ep.id)) tagMap[tag].covered++;
          }
        }
        coverageByTag = Object.entries(tagMap)
          .map(([tag, counts]) => ({ tag, ...counts }))
          .sort((a, b) => b.total - a.total);
      }

      const interpretationParts: string[] = [];
      if (unusedFlows.length === 0) interpretationParts.push('all flows are sequenced');
      else interpretationParts.push(`${unusedFlows.length} flow${unusedFlows.length === 1 ? '' : 's'} not referenced by any sequence`);
      if (apiIds.length > 0) {
        if (uncoveredEndpoints.length === 0) interpretationParts.push('all imported endpoints are covered');
        else interpretationParts.push(`${uncoveredEndpoints.length} endpoint${uncoveredEndpoints.length === 1 ? '' : 's'} have no test coverage`);
      }
      const coverageSummary = {
        flowReuse: `${flows.length - unusedFlows.length}/${flows.length} flows referenced by at least one sequence`,
        ...(apiIds.length > 0 ? {
          endpointCoverage: `${coveredEndpoints.length}/${allEndpoints.length} (${allEndpoints.length > 0 ? Math.round((coveredEndpoints.length / allEndpoints.length) * 100) : 0}%) endpoints hit by at least one flow`
        } : {}),
        interpretation: interpretationParts.join('; ') + '.',
        warningNote: unusedFlows.length === 0 && uncoveredEndpoints.length > 0
          ? 'unusedFlows: [] does NOT mean full coverage — it means all existing flows are sequenced, but there may still be uncovered endpoints with no flow at all.'
          : undefined
      };

      return asTextResult({
        projectId,
        coverageSummary,
        totalFlows: flows.length,
        totalSequences: seqResult.total,
        unusedFlows,
        flowCoverage,
        endpointCoverage: {
          totalImported: apiIds.length > 0 ? allEndpoints.length : null,
          coveredCount: coveredEndpoints.length,
          uncoveredCount: uncoveredEndpoints.length,
          coverageByTag,
          coveredEndpoints,
          uncoveredEndpoints
        }
      });
    }
  );

  server.registerTool(
    'get_flow_sequence',
    {
      title: 'Get Flow Sequence',
      description: 'Load the full raw config for a flow sequence, including complete flowJson for every step. Can return 20–100 KB depending on sequence size. For analysis or auditing use explain_sequence instead — it is human-readable and lightweight. Use this tool only when you need the raw config for editing.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number()
      }
    },
    async ({ projectId, moduleId, sequenceId }) => {
      const user = requireAuthContext(authContext);
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const flowsById = await loadSequenceFlowsForUser(sequence, user.userId);
      return asTextResult({
        sequence,
        flows: [...flowsById.values()]
      });
    }
  );

  server.registerTool(
    'add_flow_to_sequence',
    {
      title: 'Add Flow To Sequence',
      description:
        'Add an existing saved self-contained flow to a sequence. Use parameter mappings to supply the flow inputs from environment variables, previous flow outputs, static values, functions, or the current loop value after loop mode is enabled.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        testFlowId: z.number(),
        stepOrder: z.number(),
        parameterMappings: z.array(sequenceParameterMappingSchema).optional()
      }
    },
    async ({ projectId, moduleId, sequenceId, testFlowId, stepOrder, parameterMappings = [] }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const existingFlow = await getTestFlow(testFlowId, user.userId);
      if (!existingFlow) {
        throw new Error(`Test flow ${testFlowId} was not found.`);
      }

      const resolvedModuleId = moduleId ?? (await resolveModuleId(sequenceId));
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.addFlowToSequence(
        sequenceId,
        resolvedModuleId,
        projectId,
        user.userId,
        {
          test_flow_id: testFlowId,
          step_order: stepOrder,
          parameter_mappings: parameterMappings
        }
      );
      return asTextResult({ sequence });
    }
  );

  server.registerTool(
    'set_sequence_parameter_mapping',
    {
      title: 'Set Sequence Parameter Mapping',
      description:
        'Map one flow parameter in a sequence step from an environment variable, previous flow output, static primitive value, function call, or current loop value. Sequence mappings use concrete source types, not flow template syntax.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        sequenceStepId: z.string().optional(),
        stepOrder: z.number().optional(),
        mapping: sequenceParameterMappingSchema
      }
    },
    async ({ projectId, moduleId, sequenceId, sequenceStepId, stepOrder, mapping }) => {
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const updatedSequence = setSequenceParameterMapping(sequence, {
        sequenceStepId,
        stepOrder,
        mapping: mapping as FlowParameterMapping
      });
      const saved = await updateSequenceForMcp(
        updatedSequence,
        { moduleId, projectId },
        authContext
      );
      return asTextResult({ sequence: saved });
    }
  );

  server.registerTool(
    'set_sequence_loop_config',
    {
      title: 'Set Sequence Loop Config',
      description:
        'Enable, update, or disable loop mode for one sequence step. Loop config uses one recursive root loop, source rows for zip values, and optional one-level nested child loop for the current MVP.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        sequenceStepId: z.string().optional(),
        stepOrder: z.number().optional(),
        loopConfig: sequenceLoopConfigSchema
      }
    },
    async ({ projectId, moduleId, sequenceId, sequenceStepId, stepOrder, loopConfig }) => {
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const updatedSequence = setSequenceLoopConfig(sequence, {
        sequenceStepId,
        stepOrder,
        loopConfig: loopConfig as FlowLoopConfig
      });
      const saved = await updateSequenceForMcp(
        updatedSequence,
        { moduleId, projectId },
        authContext
      );
      return asTextResult({ sequence: saved });
    }
  );

  server.registerTool(
    'validate_flow_sequence',
    {
      title: 'Validate Flow Sequence',
      description:
        'Validate sequence parameter mappings, including required parameters, previous-output ordering, missing output names, unknown environment variables, and invalid function calls.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        includeEnvironmentValues: z.boolean().optional()
      }
    },
    async ({ projectId, moduleId, sequenceId, includeEnvironmentValues = true }) => {
      const user = requireAuthContext(authContext);
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const flowsById = await loadSequenceFlowsForUser(sequence, user.userId);
      const environmentVariables = await environmentVariableNamesForProject(
        projectId,
        includeEnvironmentValues,
        authContext
      );
      const result = validateFlowSequence(sequence, flowsById, environmentVariables);
      return asTextResult({ sequenceId, ...result });
    }
  );

  server.registerTool(
    'explain_sequence',
    {
      title: 'Explain Sequence',
      description:
        'Explain how a flow sequence composes self-contained flows by mapping each flow input from environment variables, previous outputs, static values, or functions.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number()
      }
    },
    async ({ projectId, moduleId, sequenceId }) => {
      const user = requireAuthContext(authContext);
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const flowsById = await loadSequenceFlowsForUser(sequence, user.userId);
      return asTextResult(explainFlowSequence(sequence, flowsById));
    }
  );

  server.registerTool(
    'create_sequence',
    {
      title: 'Create Sequence',
      description: 'Create a new empty flow sequence in a module.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number(),
        name: z.string(),
        description: z.string().optional()
      }
    },
    async ({ projectId, moduleId, name, description }) => {
      const user = requireAuthContext(authContext);
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.createSequence(moduleId, projectId, user.userId, {
        name,
        description
      });
      return asTextResult({ sequence });
    }
  );

  server.registerTool(
    'update_sequence',
    {
      title: 'Update Sequence',
      description: 'Rename a sequence or update its description.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        name: z.string().optional(),
        description: z.string().optional()
      }
    },
    async ({ projectId, moduleId, sequenceId, name, description }) => {
      const user = requireAuthContext(authContext);
      const resolvedModuleId = moduleId ?? (await resolveModuleId(sequenceId));
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.updateSequence(sequenceId, resolvedModuleId, projectId, user.userId, {
        name,
        description
      });
      return asTextResult({ sequence });
    }
  );

  server.registerTool(
    'delete_sequence',
    {
      title: 'Delete Sequence',
      description: 'Permanently delete a flow sequence.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number()
      }
    },
    async ({ projectId, moduleId, sequenceId }) => {
      const user = requireAuthContext(authContext);
      const resolvedModuleId = moduleId ?? (await resolveModuleId(sequenceId));
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      await service.deleteSequence(sequenceId, resolvedModuleId, projectId, user.userId);
      return asTextResult({ deleted: true, sequenceId });
    }
  );

  server.registerTool(
    'clone_sequence',
    {
      title: 'Clone Sequence',
      description:
        'Clone an existing flow sequence into the same module with a new name, copying all steps and parameter mappings.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        name: z.string(),
        description: z.string().optional()
      }
    },
    async ({ projectId, moduleId, sequenceId, name, description }) => {
      const user = requireAuthContext(authContext);
      const resolvedModuleId = moduleId ?? (await resolveModuleId(sequenceId));
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.cloneSequence(sequenceId, resolvedModuleId, projectId, user.userId, {
        name,
        description
      });
      return asTextResult({ sequence });
    }
  );

  server.registerTool(
    'remove_flow_from_sequence',
    {
      title: 'Remove Flow From Sequence',
      description: 'Remove a step from a sequence by its step ID.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional(),
        sequenceId: z.number(),
        sequenceStepId: z.string()
      }
    },
    async ({ projectId, moduleId, sequenceId, sequenceStepId }) => {
      const user = requireAuthContext(authContext);
      const resolvedModuleId = moduleId ?? (await resolveModuleId(sequenceId));
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.removeFlowFromSequence(
        sequenceId,
        sequenceStepId,
        resolvedModuleId,
        projectId,
        user.userId
      );
      return asTextResult({ sequence });
    }
  );

  server.registerTool(
    'create_module',
    {
      title: 'Create Module',
      description:
        'Create a new project module (folder) to organise sequences under. Returns the created module with its id — use that id immediately in create_sequence calls. Modules carry no business logic; they are purely organisational.',
      inputSchema: {
        projectId: z.number(),
        name: z.string(),
        description: z.string().optional()
      }
    },
    async ({ projectId, name, description }) => {
      const user = requireAuthContext(authContext);
      const { ProjectModuleService } = await import('$lib/server/service/projects/module_service');
      const service = new ProjectModuleService();
      const module = await service.createModule(projectId, user.userId, { name, description });
      return asTextResult({ module });
    }
  );

  server.registerTool(
    'update_module',
    {
      title: 'Update Module',
      description: 'Rename a module or update its description.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number(),
        name: z.string().optional(),
        description: z.string().optional()
      }
    },
    async ({ projectId, moduleId, name, description }) => {
      const user = requireAuthContext(authContext);
      const { ProjectModuleService } = await import('$lib/server/service/projects/module_service');
      const service = new ProjectModuleService();
      const module = await service.updateModule(moduleId, projectId, user.userId, { name, description });
      return asTextResult({ module });
    }
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List Projects',
      description:
        'List the authenticated user projects so an agent can choose the right project id before saving a flow.',
      inputSchema: {
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional()
      }
    },
    async ({ limit = 50, offset = 0 }) => {
      const user = requireAuthContext(authContext);
      const { ProjectService } = await import('$lib/server/service/projects/project_service');
      const projectService = new ProjectService();
      const result = await projectService.listUserProjects(user.userId, limit, offset);
      return asTextResult({
        total: result.total,
        projects: result.projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null
        }))
      });
    }
  );

  server.registerTool(
    'get_project_context',
    {
      title: 'Get Project Context',
      description:
        'Get the APIs and environments linked to a project, including environment variables and mappings, for flow generation. Agents should use this before create_flow_draft and ask the human to clarify when the project has multiple APIs or multiple environments.',
      inputSchema: {
        projectId: z.number(),
        includeEnvironmentValues: z.boolean().optional()
      }
    },
    async ({ projectId, includeEnvironmentValues = true }) => {
      const context = await buildProjectContext(projectId, authContext, includeEnvironmentValues);

      let endpointTags: string[] = [];
      const apiIds = context.apis.map((a) => a.id);
      if (apiIds.length > 0) {
        const { db } = await import('$lib/server/db');
        const { apiEndpoints: apiEndpointsTable } = await import('$lib/server/db/schema');
        const { inArray } = await import('drizzle-orm');
        const tagRows = await db
          .select({ tags: apiEndpointsTable.tags })
          .from(apiEndpointsTable)
          .where(inArray(apiEndpointsTable.apiId, apiIds));
        const tagSet = new Set<string>();
        for (const row of tagRows) {
          for (const tag of row.tags ?? []) {
            if (tag) tagSet.add(tag);
          }
        }
        endpointTags = [...tagSet].sort();
      }

      return asTextResult({
        project: context.project,
        modules: context.modules,
        apis: context.apis,
        endpointTags,
        environments: context.environments,
        counts: {
          apis: context.counts.apis,
          environments: context.counts.environments,
          modules: context.counts.modules
        },
        agentGuidance: {
          clarificationRequired: context.guidance.needsClarification,
          notes: context.guidance.notes
        }
      });
    }
  );

  server.registerTool(
    'search_endpoints',
    {
      title: 'Search Endpoints',
      description:
        'Search imported API endpoints within the selected project API scope. Pass apiIds directly or projectId if the project has a single API. If you are working in the backend codebase, use that context first to choose likely APIs, tags, paths, and endpoint names.',
      inputSchema: {
        userId: z.number().optional(),
        query: z.string(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        limit: z.number().min(1).max(50).default(10)
      }
    },
    async ({ userId, query, projectId, apiId, apiIds, limit }) => {
      const scopedApis = await resolveApiScope({ projectId, apiId, apiIds }, authContext);
      const { searchEndpointsByDescription } = await import(
        '$lib/server/service/api_endpoints/search_endpoints'
      );
      const endpoints = await searchEndpointsByDescription({
        query,
        userId: getUserId(userId, authContext),
        apiId: scopedApis.apiId,
        apiIds: scopedApis.apiIds,
        limit
      });
      const { searchByMetadata } = await import('$lib/server/repository/db/api-endpoints');
      const fallbackEndpoints =
        endpoints.length > 0
          ? []
          : await searchByMetadata({
              query,
              userId: getUserId(userId, authContext),
              apiId: scopedApis.apiId,
              apiIds: scopedApis.apiIds,
              limit
            });
      const authLikeQuery = /\b(login|log in|signin|sign in|auth|sso|token|bearer)\b/i.test(query);
      const note =
        endpoints.length === 0 && fallbackEndpoints.length === 0 && authLikeQuery
          ? 'No matching imported authentication endpoints were found. This may mean auth is handled outside the imported API surface, for example through SSO or an external identity provider. Consider using a flow parameter such as consumer_token with an Authorization Bearer header.'
          : undefined;
      return asTextResult({
        endpoints: endpoints.length > 0 ? endpoints : fallbackEndpoints,
        searchMode:
          endpoints.length > 0
            ? 'full_text'
            : fallbackEndpoints.length > 0
              ? 'metadata_fallback'
              : 'none',
        projectId: projectId ?? null,
        apiScope: scopedApis.apiId ? [scopedApis.apiId] : (scopedApis.apiIds ?? []),
        note
      });
    }
  );

  server.registerTool(
    'browse_endpoints',
    {
      title: 'Browse Endpoints',
      description:
        'Browse endpoints by API, tag, or path prefix within the selected project API scope. Pass apiIds directly or projectId if the project has a single API.',
      inputSchema: {
        userId: z.number().optional(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        tag: z.string().optional(),
        pathPrefix: z.string().optional(),
        limit: z.number().min(1).max(100).optional()
      }
    },
    async ({ userId, projectId, apiId, apiIds, tag, pathPrefix, limit = 50 }) => {
      const scopedApis = await resolveApiScope({ projectId, apiId, apiIds }, authContext);
      const { browseEndpoints } = await import('$lib/server/repository/db/api-endpoints');
      const endpoints = await browseEndpoints({
        userId: getUserId(userId, authContext),
        apiId: scopedApis.apiId,
        apiIds: scopedApis.apiIds,
        tag,
        pathPrefix,
        limit
      });
      return asTextResult({
        endpoints,
        projectId: projectId ?? null,
        apiScope: scopedApis.apiId ? [scopedApis.apiId] : (scopedApis.apiIds ?? [])
      });
    }
  );

  server.registerTool(
    'get_endpoint_details',
    {
      title: 'Get Endpoint Details',
      description: 'Get request and response details for a single endpoint.',
      inputSchema: {
        userId: z.number().optional(),
        endpointId: z.number(),
        summaryOnly: z.boolean().optional()
      }
    },
    async ({ userId, endpointId, summaryOnly }) => {
      const { getEndpointDetails, getEndpointSummary } = await import(
        '$lib/server/service/api_endpoints/get_endpoint_details'
      );
      const endpoint = summaryOnly
        ? await getEndpointSummary({ endpointId, userId: getUserId(userId, authContext) })
        : await getEndpointDetails({ endpointId, userId: getUserId(userId, authContext) });
      return asTextResult({ endpoint });
    }
  );

  server.registerTool(
    'list_test_flows',
    {
      title: 'List Test Flows',
      description:
        'Find reusable test flows before generating a new one. Each flow includes endpointPaths (e.g. ["GET /conversations", "POST /messages"]) so you can see coverage at a glance without loading each flow individually.',
      inputSchema: {
        page: z.number().optional(),
        limit: z.number().optional(),
        search: z.string().optional(),
        projectId: z.number().optional()
      }
    },
    async ({ page, limit, search, projectId }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlowsForUser } = await import(
        '$lib/server/service/test_flows/list_test_flows'
      );
      const flows = await getTestFlowsForUser(user.userId, { page, limit, search, projectId });

      const flowIds = flows.testFlows.map((f) => f.id);
      let endpointPathsById: Record<number, string[]> = {};
      if (flowIds.length > 0) {
        const { db } = await import('$lib/server/db');
        const { testFlows: testFlowsTable, apiEndpoints: apiEndpointsTable } = await import('$lib/server/db/schema');
        const { inArray } = await import('drizzle-orm');

        // Load flowJson for each flow to extract endpoint_id references
        const jsonRows = await db
          .select({ id: testFlowsTable.id, flowJson: testFlowsTable.flowJson })
          .from(testFlowsTable)
          .where(inArray(testFlowsTable.id, flowIds));

        // Collect all unique endpoint IDs across all flows
        const allEndpointIds = new Set<number>();
        const flowEndpointIds: Record<number, number[]> = {};
        for (const row of jsonRows) {
          const ids: number[] = [];
          for (const step of (row.flowJson as any)?.steps ?? []) {
            for (const ep of step.endpoints ?? []) {
              const rawId = ep.endpoint_id;
              const id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
              if (id && !isNaN(id)) {
                allEndpointIds.add(id);
                ids.push(id);
              }
            }
          }
          flowEndpointIds[row.id] = [...new Set(ids)];
        }

        // Batch-load method+path for all referenced endpoints
        const endpointMap: Record<number, string> = {};
        if (allEndpointIds.size > 0) {
          const epRows = await db
            .select({ id: apiEndpointsTable.id, method: apiEndpointsTable.method, path: apiEndpointsTable.path })
            .from(apiEndpointsTable)
            .where(inArray(apiEndpointsTable.id, [...allEndpointIds]));
          for (const ep of epRows) {
            endpointMap[ep.id] = `${ep.method} ${ep.path}`;
          }
        }

        for (const row of jsonRows) {
          endpointPathsById[row.id] = (flowEndpointIds[row.id] ?? [])
            .map((id) => endpointMap[id])
            .filter(Boolean) as string[];
        }
      }

      return asTextResult({
        ...flows,
        testFlows: flows.testFlows.map((f) => ({
          ...f,
          endpointPaths: endpointPathsById[f.id] ?? []
        }))
      } as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    'get_test_flow',
    {
      title: 'Get Test Flow',
      description:
        'Load a test flow. By default returns an explain_flow-style human-readable summary (lightweight). Pass includeFull: true to get the raw flowJson — only needed when you intend to edit the flow config directly.',
      inputSchema: {
        flowId: z.number(),
        includeFull: z.boolean().optional()
      }
    },
    async ({ flowId, includeFull }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const result = await getTestFlow(flowId, user.userId);
      if (!result) throw new Error(`Test flow ${flowId} was not found.`);

      if (includeFull) {
        return asTextResult(result as unknown as Record<string, unknown>);
      }

      const flowDocument: FlowDocument = {
        name: result.testFlow.name,
        flowData: {
          ...result.testFlow.flowJson,
          endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
        }
      };
      const explanation = explainFlowDocument(flowDocument);
      return asTextResult({
        flowId,
        name: result.testFlow.name,
        description: result.testFlow.description ?? null,
        projectId: result.testFlow.projectId ?? null,
        createdAt: result.testFlow.createdAt,
        updatedAt: result.testFlow.updatedAt,
        ...explanation
      });
    }
  );

  return server;
}
