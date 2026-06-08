import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { isValidOperator } from '$lib/assertions';
import type { Assertion, AssertionOperator } from '$lib/assertions/types';
import type { StepEndpoint } from '$lib/components/test-flows/types';
import {
  addAssertionToFlow,
  addFlowParameter,
  addStepToFlow,
  addTransformationToFlow,
  createExpectationAssertion,
  createFlowDraft,
  explainFlowDocument,
  linkEnvironmentToFlow,
  linkStepOutput,
  setFlowOutput,
  setHeader,
  setPathParam,
  setBodyField,
  setQueryParam,
  updateStepInFlow,
  type FlowDocument,
  validateFlowDocument
} from '$lib/mcp/flow';
import {
  explainFlowSequence,
  setSequenceLoopConfig,
  setSequenceParameterMapping,
  validateFlowSequence
} from '$lib/mcp/sequence';
import { createDraft, deleteDraft, getDraft, getDraftTtlMs, updateDraft } from '$lib/mcp/drafts';
import { createFlowRun, getFlowRun, updateFlowRun } from '$lib/mcp/runs';
import { getFlowRunTtlMs } from '$lib/mcp/runs';
import {
  createFlowSession,
  getFlowSession,
  getFlowSessionTtlMs,
  updateFlowSession
} from '$lib/mcp/sessions';
import {
  explainAssertion,
  explainTemplateExpression,
  explainTransformationExpression,
  suggestTemplateExpression
} from '$lib/mcp/explain';
import type { FlowParameterMapping, FlowSequence } from '$lib/types/flow_sequence';
import type { TestFlow } from '$lib/types/test-flow';

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
const primitiveOutputTypeSchema = z.enum(['string', 'number', 'boolean', 'null']);
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

function ttlInfo(kind: 'draft' | 'session' | 'run', expiresAt?: number) {
  const ttlMs =
    kind === 'draft'
      ? getDraftTtlMs()
      : kind === 'session'
        ? getFlowSessionTtlMs()
        : getFlowRunTtlMs();
  return {
    kind,
    ttlMs,
    ttlSeconds: Math.floor(ttlMs / 1000),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    note: `${kind[0].toUpperCase()}${kind.slice(1)} data is stored in memory only and will expire unless refreshed.`
  };
}

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

function resolveDraftOrDocument(
  args: { draftId?: string; flowDocument?: unknown },
  authContext?: McpAuthContext
): { draftId?: string; flowDocument: FlowDocument } {
  if (args.draftId) {
    const user = requireAuthContext(authContext);
    const draft = getDraft(args.draftId, user.userId);
    if (!draft) {
      throw new Error(
        `Draft ${args.draftId} was not found. It may have expired from in-memory MCP storage.`
      );
    }
    return { draftId: draft.id, flowDocument: draft.document };
  }

  if (!args.flowDocument) {
    throw new Error('Either draftId or flowDocument is required.');
  }

  return { flowDocument: args.flowDocument as FlowDocument };
}

function resolveDraftIdFromSession(sessionId: string, authContext?: McpAuthContext): string {
  const user = requireAuthContext(authContext);
  const session = getFlowSession(sessionId, user.userId);
  if (!session) {
    throw new Error(
      `Flow session ${sessionId} was not found. It may have expired from in-memory MCP storage.`
    );
  }
  if (!session.draftId) {
    throw new Error(`Flow session ${sessionId} does not have a draft yet.`);
  }
  return session.draftId;
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
    draftId?: string;
    projectId?: number;
    sessionId?: string;
  },
  authContext?: McpAuthContext
): Promise<{ apiId?: number; apiIds?: number[] }> {
  if (input.apiId || (input.apiIds && input.apiIds.length > 0)) {
    return requireApiScope({ apiId: input.apiId, apiIds: input.apiIds });
  }

  if (input.draftId) {
    const user = requireAuthContext(authContext);
    const draft = getDraft(input.draftId, user.userId);
    if (!draft) {
      throw new Error(`Draft ${input.draftId} was not found.`);
    }
    if (draft.document.apiIds?.length) {
      return { apiIds: draft.document.apiIds };
    }
    if (draft.document.projectId) {
      return resolveApiScope({ projectId: draft.document.projectId }, authContext);
    }
  }

  if (input.sessionId) {
    const user = requireAuthContext(authContext);
    const session = getFlowSession(input.sessionId, user.userId);
    if (!session) {
      throw new Error(`Flow session ${input.sessionId} was not found.`);
    }
    if (session.apiIds.length > 0) {
      return { apiIds: session.apiIds };
    }
    return resolveApiScope({ projectId: session.projectId }, authContext);
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

  const guidanceNotes = [
    'If you are working in the backend codebase, use that context first. Read routes, controllers, services, DTOs, and recent code changes to infer the business sequence and likely endpoints before relying on endpoint search alone.',
    detail.apis.length > 1
      ? 'This project has multiple APIs. Ask the human which APIs should be in scope before building or searching.'
      : 'This project has a single linked API, so API scope can be inferred if needed.',
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
    apis: detail.apis.map((apiLink) => ({
      id: apiLink.apiId,
      name: apiLink.api?.name ?? '',
      description: apiLink.api?.description ?? null,
      defaultHost: apiLink.defaultHost ?? apiLink.api?.host ?? null
    })),
    environments,
    existingFlows: existingFlows.testFlows,
    counts: {
      apis: detail.apis.length,
      environments: environments.length,
      modules: detail.modules.length,
      existingFlows: existingFlows.testFlows.length
    },
    guidance: {
      needsClarification: detail.apis.length > 1 || environments.length > 1,
      reasons: [
        ...(detail.apis.length > 1 ? ['multiple_apis'] : []),
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

async function loadSelectedEnvironmentForDocument(
  document: FlowDocument,
  overrides?: {
    environmentId?: number;
    subEnvironment?: string;
  },
  authContext?: McpAuthContext
) {
  const environmentId =
    overrides?.environmentId ??
    document.environmentId ??
    document.flowData.settings.environment?.environmentId ??
    document.flowData.settings.linkedEnvironment?.environmentId;

  if (!environmentId) {
    return null;
  }

  const user = requireAuthContext(authContext);
  const { getEnvironmentByIdAndUserId } = await import('$lib/server/repository/db/environment');
  const { resolveEnvironmentVariables } = await import(
    '$lib/server/service/environments/resolve_environment_variables'
  );

  const environment = await getEnvironmentByIdAndUserId(environmentId, user.userId);
  if (!environment) {
    throw new Error(`Environment ${environmentId} was not found for this user.`);
  }

  const subEnvironment =
    overrides?.subEnvironment ??
    document.flowData.settings.environment?.subEnvironment ??
    Object.keys(environment.config.environments ?? {})[0] ??
    null;

  if (!subEnvironment) {
    return { environment, resolvedVariables: {} };
  }

  const resolved = resolveEnvironmentVariables(
    environment.id,
    environment.name,
    subEnvironment,
    environment.config
  );
  return {
    environment,
    resolvedVariables: resolved.variables
  };
}

async function resolveDraftSelections(
  input: { projectId?: number; apiIds?: number[]; environmentId?: number },
  authContext?: McpAuthContext
): Promise<{ apiIds?: number[]; environmentId?: number }> {
  if (!input.projectId) {
    return { apiIds: input.apiIds, environmentId: input.environmentId };
  }

  const detail = await getProjectDetailForUser(input.projectId, authContext);
  const projectApiIds = new Set(detail.apis.map((api) => api.apiId));
  const projectEnvironmentIds = new Set(
    detail.environments.map((environment) => environment.environmentId)
  );
  const resolvedApiIds =
    input.apiIds && input.apiIds.length > 0
      ? input.apiIds
      : detail.apis.length === 1
        ? [detail.apis[0].apiId]
        : undefined;
  const resolvedEnvironmentId =
    input.environmentId !== undefined
      ? input.environmentId
      : detail.environments.length === 1
        ? detail.environments[0].environmentId
        : undefined;

  if (detail.apis.length > 1 && (!resolvedApiIds || resolvedApiIds.length === 0)) {
    throw new Error(
      `Project ${input.projectId} has multiple APIs. Ask the human to clarify which APIs this flow should use, then call create_flow_draft with apiIds. Available APIs: ${detail.apis.map((api) => `${api.apiId}:${api.api?.name || `API ${api.apiId}`}`).join(', ')}.`
    );
  }

  if (resolvedApiIds?.some((apiId) => !projectApiIds.has(apiId))) {
    throw new Error(
      `One or more apiIds are not linked to project ${input.projectId}. Available APIs: ${detail.apis.map((api) => api.apiId).join(', ')}.`
    );
  }

  if (detail.environments.length > 1 && resolvedEnvironmentId === undefined) {
    throw new Error(
      `Project ${input.projectId} has multiple environments. Ask the human which environment to link before creating the flow draft. Available environments: ${detail.environments.map((environment) => `${environment.environmentId}:${environment.environment?.name || `Environment ${environment.environmentId}`}`).join(', ')}.`
    );
  }

  if (resolvedEnvironmentId !== undefined && !projectEnvironmentIds.has(resolvedEnvironmentId)) {
    throw new Error(
      `Environment ${resolvedEnvironmentId} is not linked to project ${input.projectId}. Available environments: ${detail.environments.map((environment) => environment.environmentId).join(', ')}.`
    );
  }

  return {
    apiIds: resolvedApiIds,
    environmentId: resolvedEnvironmentId
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
  const existingHosts = document.flowData.settings.api_hosts ?? {};
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

async function getSequenceForMcp(
  input: {
    sequenceId: number;
    moduleId: number;
    projectId: number;
  },
  authContext?: McpAuthContext
): Promise<FlowSequence> {
  const user = requireAuthContext(authContext);
  const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
  const service = new FlowSequenceService();
  return service.getFlowSequence(input.sequenceId, input.moduleId, input.projectId, user.userId);
}

async function updateSequenceForMcp(
  sequence: FlowSequence,
  input: {
    moduleId: number;
    projectId: number;
  },
  authContext?: McpAuthContext
): Promise<FlowSequence> {
  const user = requireAuthContext(authContext);
  const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
  const service = new FlowSequenceService();
  return service.updateSequence(sequence.id, input.moduleId, input.projectId, user.userId, {
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
        agentWorkflow: [
          'For a new flow, call prepare_flow_context(projectId) first to inspect APIs, environments, existing flows, and clarification needs.',
          'If guidance says clarification is needed, ask the human to choose APIs and/or environment before drafting.',
          'Start stateful work with start_flow_session(projectId), then choose_flow_scope when APIs/environment are known.',
          'Create or load a draft with create_flow_draft, start_edit_flow_session, get_flow_session, or get_draft.',
          'Find endpoints with search_endpoints or browse_endpoints, then build steps with add_step or update_step.',
          'Use add_transformation for response data needed later, link_step_output for dependencies, and add_assertion or add_expectation_assertion for checks.',
          'Before save or run, call validate_flow and review_flow_session.'
        ],
        keyTools: {
          context: ['prepare_flow_context', 'get_project_context', 'get_flow_session', 'get_draft'],
          endpointDiscovery: ['search_endpoints', 'browse_endpoints', 'get_endpoint_detail'],
          drafting: [
            'start_flow_session',
            'choose_flow_scope',
            'create_flow_draft',
            'add_step',
            'update_step'
          ],
          dataDependencies: [
            'add_transformation',
            'suggest_expression',
            'link_step_output',
            'link_parameter'
          ],
          validation: ['validate_flow', 'explain_flow', 'review_flow_session'],
          execution: ['run_flow', 'get_flow_run', 'save_flow']
        },
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
            'Do not reference environment values directly in flows. Add a flow parameter, then map it to an environment variable.'
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
    'start_flow_session',
    {
      title: 'Start Flow Session',
      description:
        'Start a stateful V2 flow-building session for a project. If you are working in the backend codebase, inspect routes, controllers, services, DTOs, and recent code changes to infer the likely journey before selecting APIs and building steps. Scope selection happens next.',
      inputSchema: {
        projectId: z.number()
      }
    },
    async ({ projectId }) => {
      await getProjectDetailForUser(projectId, authContext);
      const user = requireAuthContext(authContext);
      const session = createFlowSession(user.userId, projectId);
      const context = await buildProjectContext(projectId, authContext, false);
      return asTextResult({
        sessionId: session.id,
        projectId: session.projectId,
        status: session.status,
        guidance: context.guidance,
        sessionTtl: ttlInfo('session', session.expiresAt)
      });
    }
  );

  server.registerTool(
    'start_edit_flow_session',
    {
      title: 'Start Edit Flow Session',
      description:
        'Load an existing saved flow into a stateful session draft so the agent can edit it in place instead of creating a new flow every time. If you are working in the codebase, compare the saved flow against current routes, handlers, request/response shapes, and business logic before editing.',
      inputSchema: {
        flowId: z.number()
      }
    },
    async ({ flowId }) => {
      const user = requireAuthContext(authContext);
      const result = await (
        await import('$lib/server/service/test_flows/get_test_flow')
      ).getTestFlow(flowId, user.userId);
      if (!result) {
        throw new Error(`Test flow ${flowId} was not found.`);
      }

      const apiIds = (result.testFlow.apis ?? []).map((api) => api.id);
      const flowDocument: FlowDocument = {
        sourceFlowId: result.testFlow.id,
        name: result.testFlow.name,
        description: result.testFlow.description ?? undefined,
        projectId: result.testFlow.projectId ?? undefined,
        apiIds,
        environmentId: result.testFlow.environmentId ?? undefined,
        flowData: {
          ...result.testFlow.flowJson,
          endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
        }
      };

      const session = createFlowSession(user.userId, result.testFlow.projectId ?? 0, {
        sourceFlowId: result.testFlow.id
      });
      const draft = createDraft(user.userId, flowDocument);
      updateFlowSession(session.id, user.userId, {
        apiIds,
        environmentId: result.testFlow.environmentId ?? undefined,
        draftId: draft.id,
        status: 'draft_created'
      });

      return asTextResult({
        sessionId: session.id,
        draftId: draft.id,
        flowId: result.testFlow.id,
        mode: 'edit',
        flowDocument,
        sessionTtl: ttlInfo('session', session.expiresAt),
        draftTtl: ttlInfo('draft', draft.expiresAt)
      });
    }
  );

  server.registerTool(
    'select_flow_scope',
    {
      title: 'Select Flow Scope',
      description:
        'Choose the APIs and environment for a V2 flow session. If the project has multiple APIs or environments, the human should clarify those choices before this tool is called.',
      inputSchema: {
        sessionId: z.string(),
        apiIds: z.array(z.number()).optional(),
        environmentId: z.number().optional(),
        subEnvironment: z.string().optional()
      }
    },
    async ({ sessionId, apiIds, environmentId, subEnvironment }) => {
      const user = requireAuthContext(authContext);
      const session = getFlowSession(sessionId, user.userId);
      if (!session) {
        throw new Error(
          `Flow session ${sessionId} was not found. It may have expired from in-memory MCP storage.`
        );
      }

      const resolvedSelections = await resolveDraftSelections(
        { projectId: session.projectId, apiIds, environmentId },
        authContext
      );
      const updated = updateFlowSession(sessionId, user.userId, {
        apiIds: resolvedSelections.apiIds ?? [],
        environmentId: resolvedSelections.environmentId,
        subEnvironment,
        status: 'ready_for_draft'
      });

      return asTextResult({
        sessionId: updated.id,
        status: updated.status,
        scope: {
          projectId: updated.projectId,
          apiIds: updated.apiIds,
          environmentId: updated.environmentId ?? null,
          subEnvironment: updated.subEnvironment ?? null
        },
        sessionTtl: ttlInfo('session', updated.expiresAt)
      });
    }
  );

  server.registerTool(
    'get_flow_session',
    {
      title: 'Get Flow Session',
      description:
        'Recover the current V2 flow session, including selected scope and any linked draft.',
      inputSchema: {
        sessionId: z.string()
      }
    },
    async ({ sessionId }) => {
      const user = requireAuthContext(authContext);
      const session = getFlowSession(sessionId, user.userId);
      if (!session) {
        throw new Error(
          `Flow session ${sessionId} was not found. It may have expired from in-memory MCP storage.`
        );
      }

      const draft = session.draftId ? getDraft(session.draftId, user.userId) : null;
      return asTextResult({
        sessionId: session.id,
        status: session.status,
        sourceFlowId: session.sourceFlowId ?? null,
        scope: {
          projectId: session.projectId,
          apiIds: session.apiIds,
          environmentId: session.environmentId ?? null,
          subEnvironment: session.subEnvironment ?? null
        },
        draftId: session.draftId ?? null,
        flowDocument: draft?.document ?? null,
        sessionTtl: ttlInfo('session', session.expiresAt),
        draftTtl: draft ? ttlInfo('draft', draft.expiresAt) : null
      });
    }
  );

  server.registerTool(
    'suggest_flow_reuse',
    {
      title: 'Suggest Flow Reuse',
      description:
        'Suggest whether to reuse an existing flow, clone one, or create a new flow for the current session. If you can inspect the codebase, use that context to judge whether the existing flow still matches the current implementation and business sequence.',
      inputSchema: {
        sessionId: z.string(),
        intent: z.string().optional()
      }
    },
    async ({ sessionId, intent = '' }) => {
      const user = requireAuthContext(authContext);
      const session = getFlowSession(sessionId, user.userId);
      if (!session) {
        throw new Error(`Flow session ${sessionId} was not found.`);
      }

      const { getTestFlowsForUser } = await import(
        '$lib/server/service/test_flows/list_test_flows'
      );
      const flows = await getTestFlowsForUser(user.userId, {
        projectId: session.projectId,
        search: intent.trim() || undefined,
        limit: 10,
        page: 1
      });

      const candidates = flows.testFlows.slice(0, 5);
      const decision = candidates.length > 0 ? 'review_existing' : 'create_new';
      const reason =
        decision === 'review_existing'
          ? 'Found existing flows in the same project that may cover part of this journey.'
          : 'No close existing flows were found in the selected project, so creating a new flow is the safer default.';

      return asTextResult({
        sessionId,
        decision,
        reason,
        candidates
      });
    }
  );

  server.registerTool(
    'create_flow_draft',
    {
      title: 'Create Flow Draft',
      description:
        'Create a new stateful Test-Pilot flow draft. Before building steps, prefer using backend codebase context such as routes, controllers, services, DTOs, and changed files to infer the correct API sequence. If the selected project has multiple APIs or environments and the human did not specify which ones to use, stop and ask for clarification before calling this tool.',
      inputSchema: {
        sessionId: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        projectId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        environmentId: z.number().optional(),
        apiHosts: z
          .record(z.string(), z.object({ url: z.string(), name: z.string().optional() }))
          .optional(),
        parameters: z
          .array(
            z.object({
              name: z.string(),
              type: primitiveParameterTypeSchema,
              value: z.unknown().optional(),
              defaultValue: z.unknown().optional(),
              description: z.string().optional(),
              required: z.boolean()
            })
          )
          .optional()
      }
    },
    async ({
      sessionId,
      name,
      description,
      projectId,
      apiIds,
      environmentId,
      apiHosts,
      parameters
    }) => {
      const user = requireAuthContext(authContext);
      const session = sessionId ? getFlowSession(sessionId, user.userId) : null;
      if (sessionId && !session) {
        throw new Error(
          `Flow session ${sessionId} was not found. It may have expired from in-memory MCP storage.`
        );
      }

      const baseProjectId = projectId ?? session?.projectId;
      const baseApiIds = apiIds ?? (session?.apiIds.length ? session.apiIds : undefined);
      const baseEnvironmentId = environmentId ?? session?.environmentId;
      const resolvedSelections = await resolveDraftSelections(
        { projectId: baseProjectId, apiIds: baseApiIds, environmentId: baseEnvironmentId },
        authContext
      );
      const flowDocument = createFlowDraft({
        name,
        description,
        projectId: baseProjectId,
        apiIds: resolvedSelections.apiIds,
        environmentId: resolvedSelections.environmentId,
        subEnvironment: session?.subEnvironment,
        apiHosts,
        parameters
      });
      const draft = createDraft(user.userId, flowDocument);
      if (session) {
        updateFlowSession(session.id, user.userId, {
          draftId: draft.id,
          status: 'draft_created'
        });
      }
      return asTextResult({
        sessionId: session?.id ?? null,
        draftId: draft.id,
        flowDocument,
        selectionSummary: {
          projectId: flowDocument.projectId ?? null,
          apiIds: flowDocument.apiIds ?? [],
          environmentId: flowDocument.environmentId ?? null
        },
        templateSyntaxGuide: {
          parameters:
            'Use {{param:name}} to reference a flow parameter. Bare {{name}} is not valid.',
          responses: 'Use {{res:stepId-0.$.path}} for a response reference.',
          transformations: 'Use {{proc:stepId-0.$.alias}} for a transformation alias.'
        },
        draftTtl: ttlInfo('draft', draft.expiresAt),
        sessionTtl: session ? ttlInfo('session', session.expiresAt) : null
      });
    }
  );

  server.registerTool(
    'get_draft',
    {
      title: 'Get Draft',
      description:
        'Load the current server-side draft document by draftId so an agent can recover context mid-session.',
      inputSchema: {
        draftId: z.string()
      }
    },
    async ({ draftId }) => {
      const user = requireAuthContext(authContext);
      const draft = getDraft(draftId, user.userId);
      if (!draft) {
        throw new Error(
          `Draft ${draftId} was not found. It may have expired from in-memory MCP storage.`
        );
      }

      return asTextResult({
        draftId: draft.id,
        flowDocument: draft.document,
        selectionSummary: {
          projectId: draft.document.projectId ?? null,
          apiIds: draft.document.apiIds ?? [],
          environmentId: draft.document.environmentId ?? null
        },
        draftTtl: ttlInfo('draft', draft.expiresAt)
      });
    }
  );

  server.registerTool(
    'add_step',
    {
      title: 'Add Step',
      description: 'Append a step to a flow draft and return the updated document.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
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
    async ({ draftId, flowDocument, ...stepInput }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = addStepToFlow(resolved.flowDocument, {
        ...stepInput,
        endpoints: normalizeStepEndpoints(
          stepInput.endpoints as unknown as Array<Record<string, unknown>> | undefined
        )
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'update_step',
    {
      title: 'Update Step',
      description: 'Update an existing step without rebuilding the full draft.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        label: z.string().optional(),
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
    async ({ draftId, sessionId, flowDocument, ...stepInput }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const updated = updateStepInFlow(resolved.flowDocument, {
        ...stepInput,
        endpoints: normalizeStepEndpoints(
          stepInput.endpoints as unknown as Array<Record<string, unknown>> | undefined
        )
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'add_flow_parameter',
    {
      title: 'Add Flow Parameter',
      description:
        'Add or update a primitive flow input parameter on the draft. Environment values should enter a standalone flow by mapping an environment variable to one of these parameters.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
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
    async ({ draftId, flowDocument, parameter }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = addFlowParameter(resolved.flowDocument, parameter);
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'add_transformation',
    {
      title: 'Add Transformation',
      description:
        'Add or update an endpoint transformation by alias. Transformations read their own endpoint response. Functions are pipeline stages only: use value | fn(args...), not fn(value, args). Operators like +, *, ==, && are normal expressions and may be used inside arguments or object mappings.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        alias: z.string(),
        expression: z.string().describe(transformationExpressionDescription)
      }
    },
    async ({ draftId, sessionId, flowDocument, stepId, endpointIndex, alias, expression }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const updated = addTransformationToFlow(resolved.flowDocument, {
        stepId,
        endpointIndex,
        alias,
        expression
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        transformation: { alias, expression },
        explanation: explainTransformationExpression(expression),
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'set_flow_output',
    {
      title: 'Set Flow Output',
      description:
        'Add or update a primitive flow output. Outputs make a self-contained flow usable in sequences where later flow parameters can be mapped from previous flow outputs.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        output: z.object({
          name: z.string(),
          description: z.string().optional(),
          value: z.string(),
          isTemplate: z.boolean().optional(),
          type: primitiveOutputTypeSchema.optional(),
          castToType: z.boolean().optional()
        })
      }
    },
    async ({ draftId, sessionId, flowDocument, output }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const updated = setFlowOutput(resolved.flowDocument, output);
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        output,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'bind_parameter_to_environment',
    {
      title: 'Bind Parameter To Environment',
      description:
        'Map a flow parameter to an environment variable on the draft linked environment. This is the only MCP-supported way for standalone flows to receive environment values while staying self-contained.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        parameterName: z.string(),
        environmentVariable: z.string()
      }
    },
    async ({ draftId, sessionId, flowDocument, parameterName, environmentVariable }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const user = requireAuthContext(authContext);
      const session = sessionId ? getFlowSession(sessionId, user.userId) : null;

      const environmentId =
        resolved.flowDocument.environmentId ??
        resolved.flowDocument.flowData.settings.environment?.environmentId ??
        resolved.flowDocument.flowData.settings.linkedEnvironment?.environmentId ??
        session?.environmentId;

      if (!environmentId) {
        throw new Error(
          'No environment is linked to this draft yet. Select a session environment or link an environment first.'
        );
      }

      const existingName =
        resolved.flowDocument.flowData.settings.linkedEnvironment?.environmentName;
      let environmentName = existingName;
      if (!environmentName) {
        const { getEnvironmentByIdAndUserId } = await import(
          '$lib/server/repository/db/environment'
        );
        const environment = await getEnvironmentByIdAndUserId(environmentId, user.userId);
        if (!environment) {
          throw new Error(`Environment ${environmentId} was not found for this user.`);
        }
        environmentName = environment.name;
      }

      const parameterMappings = {
        ...(resolved.flowDocument.flowData.settings.linkedEnvironment?.parameterMappings ?? {}),
        [parameterName]: environmentVariable
      };
      const updated = linkEnvironmentToFlow(resolved.flowDocument, {
        environmentId,
        environmentName,
        selectedSubEnvironment:
          resolved.flowDocument.flowData.settings.environment?.subEnvironment ??
          session?.subEnvironment,
        parameterMappings
      });

      if (resolved.draftId) {
        updateDraft(resolved.draftId, user.userId, updated);
      }

      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        parameterName,
        environmentVariable,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'link_environment_to_flow',
    {
      title: 'Link Environment To Flow',
      description:
        'Link a project environment to the flow and map environment variables to flow parameters.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        environmentId: z.number(),
        environmentName: z.string(),
        selectedSubEnvironment: z.string().optional(),
        parameterMappings: z.record(z.string(), z.string()).optional()
      }
    },
    async ({
      draftId,
      flowDocument,
      environmentId,
      environmentName,
      selectedSubEnvironment,
      parameterMappings
    }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = linkEnvironmentToFlow(resolved.flowDocument, {
        environmentId,
        environmentName,
        selectedSubEnvironment,
        parameterMappings
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'set_body_field',
    {
      title: 'Set Body Field',
      description: 'Patch a single request body field on an existing draft step endpoint.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        fieldPath: z.string(),
        value: z.unknown()
      }
    },
    async ({ draftId, flowDocument, stepId, endpointIndex, fieldPath, value }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = setBodyField(resolved.flowDocument, {
        stepId,
        endpointIndex,
        fieldPath,
        value
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'set_path_param',
    {
      title: 'Set Path Param',
      description: 'Patch a single path parameter on an existing draft step endpoint.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        name: z.string(),
        value: z.string()
      }
    },
    async ({ draftId, sessionId, flowDocument, stepId, endpointIndex, name, value }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const updated = setPathParam(resolved.flowDocument, { stepId, endpointIndex, name, value });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'set_header',
    {
      title: 'Set Header',
      description: 'Patch a single header on an existing draft step endpoint.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        name: z.string(),
        value: z.string(),
        enabled: z.boolean().optional()
      }
    },
    async ({ draftId, sessionId, flowDocument, stepId, endpointIndex, name, value, enabled }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const updated = setHeader(resolved.flowDocument, {
        stepId,
        endpointIndex,
        name,
        value,
        enabled
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'set_query_param',
    {
      title: 'Set Query Param',
      description: 'Patch a single query parameter on an existing draft step endpoint.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        name: z.string(),
        value: z.union([z.string(), z.array(z.string())])
      }
    },
    async ({ draftId, flowDocument, stepId, endpointIndex, name, value }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = setQueryParam(resolved.flowDocument, { stepId, endpointIndex, name, value });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'bind_request_field_to_parameter',
    {
      title: 'Bind Request Field To Parameter',
      description:
        'Bind a request field to a flow parameter using canonical Test-Pilot template syntax.',
      inputSchema: {
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        targetFieldType: z.enum(['body', 'queryParams', 'pathParams', 'headers']),
        fieldName: z.string(),
        nestedFieldPath: z.string().optional(),
        parameterName: z.string(),
        preserveType: z.boolean().optional(),
        headerEnabled: z.boolean().optional()
      }
    },
    async ({
      draftId,
      sessionId,
      flowDocument,
      stepId,
      endpointIndex,
      targetFieldType,
      fieldName,
      nestedFieldPath,
      parameterName,
      preserveType,
      headerEnabled
    }) => {
      const resolvedDraftId =
        draftId ?? (sessionId ? resolveDraftIdFromSession(sessionId, authContext) : undefined);
      const resolved = resolveDraftOrDocument(
        { draftId: resolvedDraftId, flowDocument },
        authContext
      );
      const { expression } = suggestTemplateExpression({
        source: 'param',
        parameterName,
        preserveType
      });

      let updated = resolved.flowDocument;
      if (targetFieldType === 'body') {
        updated = setBodyField(updated, {
          stepId,
          endpointIndex,
          fieldPath: nestedFieldPath ?? fieldName,
          value: expression
        });
      } else if (targetFieldType === 'queryParams') {
        updated = setQueryParam(updated, {
          stepId,
          endpointIndex,
          name: fieldName,
          value: expression
        });
      } else if (targetFieldType === 'pathParams') {
        updated = setPathParam(updated, {
          stepId,
          endpointIndex,
          name: fieldName,
          value: expression
        });
      } else {
        updated = setHeader(updated, {
          stepId,
          endpointIndex,
          name: fieldName,
          value: expression,
          enabled: headerEnabled
        });
      }

      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }

      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        expression,
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'link_step_output',
    {
      title: 'Link Step Output',
      description:
        'Wire a response or transformation output from one step into a field on a later step.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        sourceType: z.enum(['res', 'proc']),
        fromStepId: z.string(),
        fromEndpointIndex: z.number().optional(),
        alias: z.string().optional(),
        jsonPath: z.string().optional(),
        preserveType: z.boolean().optional(),
        toStepId: z.string(),
        toEndpointIndex: z.number().optional(),
        targetFieldType: z.enum(['body', 'queryParams', 'pathParams', 'headers']),
        fieldName: z.string(),
        nestedFieldPath: z.string().optional(),
        headerEnabled: z.boolean().optional()
      }
    },
    async (input) => {
      const { draftId, flowDocument, ...linkInput } = input;
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const linked = linkStepOutput(resolved.flowDocument, linkInput);
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, linked.document);
      }
      return asTextResult({
        draftId: resolved.draftId,
        expression: linked.expression,
        flowDocument: linked.document
      });
    }
  );

  server.registerTool(
    'add_expectation',
    {
      title: 'Add Expectation',
      description:
        'Create a safe canonical assertion from structured intent and append it to a step endpoint. Prefer this over add_assertion so the MCP can choose the correct operator and assertion shape.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        expectation: z.object({
          kind: z.enum([
            'status_success',
            'field_exists',
            'field_type',
            'equals',
            'response_time_under'
          ]),
          source: z.enum(['response', 'transformed_data']).optional(),
          jsonPath: z.string().optional(),
          headerName: z.string().optional(),
          expectedType: z
            .enum(['string', 'number', 'boolean', 'array', 'object', 'null'])
            .optional(),
          expectedValue: z.unknown().optional(),
          maxMs: z.number().optional(),
          id: z.string().optional(),
          enabled: z.boolean().optional()
        })
      }
    },
    async ({ draftId, flowDocument, stepId, endpointIndex, expectation }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const assertion = createExpectationAssertion(expectation);
      const updated = addAssertionToFlow(resolved.flowDocument, {
        stepId,
        endpointIndex,
        assertion
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({
        draftId: resolved.draftId,
        assertion,
        explanation: explainAssertion(assertion),
        flowDocument: updated
      });
    }
  );

  server.registerTool(
    'add_assertion',
    {
      title: 'Add Assertion',
      description: 'Append a single assertion to an existing draft step endpoint.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        stepId: z.string(),
        endpointIndex: z.number().optional(),
        assertion: z.object({
          id: z.string(),
          data_source: z.enum(['response', 'transformed_data']),
          assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
          data_id: z.string(),
          operator: z.string(),
          expected_value: z.unknown(),
          enabled: z.boolean(),
          is_template_expression: z.boolean().optional()
        })
      }
    },
    async ({ draftId, flowDocument, stepId, endpointIndex, assertion }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const updated = addAssertionToFlow(resolved.flowDocument, {
        stepId,
        endpointIndex,
        assertion: normalizeAssertionInput(assertion)
      });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
    }
  );

  server.registerTool(
    'validate_flow',
    {
      title: 'Validate Flow',
      description:
        'Validate structure, references, and common expression risks for a stateless flow draft.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional()
      }
    },
    async ({ draftId, flowDocument }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const result = validateFlowDocument(resolved.flowDocument);
      return asTextResult({ draftId: resolved.draftId, ...result });
    }
  );

  server.registerTool(
    'review_flow_session',
    {
      title: 'Review Flow Session',
      description:
        'Generate a human-readable review of the current flow session before save or run.',
      inputSchema: {
        sessionId: z.string()
      }
    },
    async ({ sessionId }) => {
      const user = requireAuthContext(authContext);
      const session = getFlowSession(sessionId, user.userId);
      if (!session) {
        throw new Error(`Flow session ${sessionId} was not found.`);
      }
      if (!session.draftId) {
        throw new Error(`Flow session ${sessionId} does not have a draft yet.`);
      }

      const draft = getDraft(session.draftId, user.userId);
      if (!draft) {
        throw new Error(`Draft ${session.draftId} was not found.`);
      }

      const validation = validateFlowDocument(draft.document);
      const explanation = explainFlowDocument(draft.document);
      const linkedEnvironment = draft.document.flowData.settings.linkedEnvironment;

      return asTextResult({
        sessionId,
        status: session.status,
        sourceFlowId: session.sourceFlowId ?? draft.document.sourceFlowId ?? null,
        scope: {
          projectId: session.projectId,
          apiIds: session.apiIds,
          environmentId: session.environmentId ?? null,
          subEnvironment: session.subEnvironment ?? null
        },
        review: {
          summary: explanation.summary,
          parameters: draft.document.flowData.parameters,
          linkedEnvironment,
          validation,
          steps: explanation.steps,
          dependencies: explanation.dependencies,
          warnings: explanation.warnings
        }
      });
    }
  );

  server.registerTool(
    'explain_flow',
    {
      title: 'Explain Flow',
      description:
        'Explain a complete flow draft step-by-step, including dependencies and warnings.',
      inputSchema: {
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional()
      }
    },
    async ({ draftId, flowDocument }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const explanation = explainFlowDocument(resolved.flowDocument);
      return asTextResult({ draftId: resolved.draftId, ...explanation });
    }
  );

  server.registerTool(
    'run_flow',
    {
      title: 'Run Flow',
      description:
        'Run a saved test flow or the current session draft using the existing FlowRunner engine and return a run id for reporting.',
      inputSchema: {
        sessionId: z.string().optional(),
        draftId: z.string().optional(),
        flowId: z.number().optional(),
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
    async ({
      sessionId,
      draftId,
      flowId,
      parameterOverrides,
      environmentOverrides,
      preferences
    }) => {
      const user = requireAuthContext(authContext);
      let sourceDocument: FlowDocument | null = null;
      let sourceDraftId = draftId;

      if (flowId !== undefined) {
        const result = await (
          await import('$lib/server/service/test_flows/get_test_flow')
        ).getTestFlow(flowId, user.userId);
        if (!result) {
          throw new Error(`Test flow ${flowId} was not found.`);
        }
        sourceDocument = {
          name: result.testFlow.name,
          description: result.testFlow.description ?? undefined,
          projectId: result.testFlow.projectId ?? undefined,
          flowData: {
            ...result.testFlow.flowJson,
            endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
          }
        };
      } else {
        if (!sourceDraftId && sessionId) {
          sourceDraftId = resolveDraftIdFromSession(sessionId, authContext);
        }
        const resolved = resolveDraftOrDocument({ draftId: sourceDraftId }, authContext);
        sourceDocument = resolved.flowDocument;
        sourceDraftId = resolved.draftId;
      }

      let runnableDocument = await hydrateFlowDocumentEndpoints(
        await ensureFlowHasApiHosts(sourceDocument, authContext)
      );
      if (parameterOverrides && Object.keys(parameterOverrides).length > 0) {
        runnableDocument = {
          ...runnableDocument,
          flowData: {
            ...runnableDocument.flowData,
            parameters: runnableDocument.flowData.parameters.map((parameter) =>
              Object.prototype.hasOwnProperty.call(parameterOverrides, parameter.name)
                ? {
                    ...parameter,
                    defaultValue: parameterOverrides[parameter.name]
                  }
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

      const environmentState = await loadSelectedEnvironmentForDocument(
        effectiveDocument,
        environmentOverrides,
        authContext
      );
      const { FlowRunner } = await import('$lib/flow-runner/flow-runner');

      const run = createFlowRun(user.userId, {
        flowId,
        sessionId,
        draftId: sourceDraftId
      });

      const logs: Array<{
        level: 'info' | 'debug' | 'error' | 'warning';
        message: string;
        details?: string;
      }> = [];
      let executionState: Record<string, unknown> = {};
      let completionData: {
        success: boolean;
        error?: unknown;
        storedResponses: Record<string, unknown>;
        parameterValues: Record<string, unknown>;
        flowOutputs: Record<string, unknown>;
      } | null = null;

      const runner = new FlowRunner({
        flowData: effectiveDocument.flowData,
        preferences: {
          parallelExecution: preferences?.parallelExecution ?? false,
          stopOnError: preferences?.stopOnError ?? true,
          serverCookieHandling: false,
          retryCount: preferences?.retryCount ?? 0,
          timeout: preferences?.timeout ?? 30000
        },
        selectedEnvironment: environmentState?.environment ?? null,
        environmentVariables: environmentState?.resolvedVariables ?? {},
        onLog: (level, message, details) => {
          logs.push({ level, message, details });
        },
        onExecutionStateUpdate: (state) => {
          executionState = structuredClone(state);
        },
        onEndpointStateUpdate: ({ endpointId, state }) => {
          executionState = {
            ...executionState,
            [endpointId]: state
          };
        },
        onExecutionComplete: (data) => {
          completionData = data;
        }
      });

      const result = await runner.runFlow();
      const finalCompletion = completionData ?? {
        success: result.success,
        error: result.error,
        storedResponses: {},
        parameterValues: {},
        flowOutputs: {}
      };

      const failedEndpoint = Object.entries(executionState).find(
        ([, state]) =>
          typeof state === 'object' &&
          state !== null &&
          (state as { status?: string }).status === 'failed'
      )?.[0];
      const summary = result.success
        ? `Flow executed successfully with ${effectiveDocument.flowData.steps.length} steps.`
        : 'parametersWithMissingValues' in result && result.parametersWithMissingValues?.length
          ? `Flow requires parameter values for: ${result.parametersWithMissingValues.map((parameter) => parameter.name).join(', ')}.`
          : failedEndpoint
            ? `Flow failed at ${failedEndpoint}.`
            : `Flow execution failed${result.error ? `: ${String(result.error)}` : '.'}`;

      updateFlowRun(run.id, user.userId, {
        status: result.success ? 'completed' : 'failed',
        success: result.success,
        summary,
        error: result.error ? String(result.error) : undefined,
        completedAt: Date.now(),
        executionState,
        logs,
        storedResponses: finalCompletion.storedResponses,
        parameterValues: finalCompletion.parameterValues,
        flowOutputs: finalCompletion.flowOutputs
      });

      return asTextResult({
        runId: run.id,
        status: result.success ? 'completed' : 'failed',
        summary,
        validation,
        executionMode: {
          serverCookieHandling: false,
          note: 'MCP server-side execution uses direct HTTP requests with the shared cookie store instead of the browser proxy path.'
        },
        resolvedEnvironment: {
          environmentId:
            effectiveDocument.environmentId ??
            effectiveDocument.flowData.settings.environment?.environmentId ??
            null,
          subEnvironment: effectiveDocument.flowData.settings.environment?.subEnvironment ?? null
        },
        runTtl: ttlInfo('run', run.expiresAt),
        missingParameters:
          'parametersWithMissingValues' in result
            ? (result.parametersWithMissingValues?.map((parameter) => parameter.name) ?? [])
            : []
      });
    }
  );

  server.registerTool(
    'get_run_report',
    {
      title: 'Get Run Report',
      description: 'Get a concise engineering report for a previously started MCP flow run.',
      inputSchema: {
        runId: z.string()
      }
    },
    async ({ runId }) => {
      const user = requireAuthContext(authContext);
      const run = getFlowRun(runId, user.userId);
      if (!run) {
        throw new Error(`Flow run ${runId} was not found.`);
      }

      const failedEndpoints = Object.entries(run.executionState)
        .filter(
          ([, state]) =>
            typeof state === 'object' &&
            state !== null &&
            (state as { status?: string }).status === 'failed'
        )
        .map(([endpointId, state]) => ({
          endpointId,
          error: (state as { error?: string }).error ?? null
        }));

      return asTextResult({
        runId: run.id,
        status: run.status,
        success: run.success,
        summary: run.summary,
        failedEndpoints,
        parameterValues: run.parameterValues,
        flowOutputs: run.flowOutputs,
        logTail: run.logs.slice(-20),
        runTtl: ttlInfo('run', run.expiresAt)
      });
    }
  );

  server.registerTool(
    'explain_run_failure',
    {
      title: 'Explain Run Failure',
      description:
        'Explain the most likely failing endpoint and error from a previous MCP flow run in plain English.',
      inputSchema: {
        runId: z.string()
      }
    },
    async ({ runId }) => {
      const user = requireAuthContext(authContext);
      const run = getFlowRun(runId, user.userId);
      if (!run) {
        throw new Error(`Flow run ${runId} was not found.`);
      }

      const failedEntry = Object.entries(run.executionState).find(
        ([, state]) =>
          typeof state === 'object' &&
          state !== null &&
          (state as { status?: string }).status === 'failed'
      );

      const explanation = failedEntry
        ? `The run failed at ${failedEntry[0]}${(failedEntry[1] as { error?: string }).error ? ` with error: ${(failedEntry[1] as { error?: string }).error}` : '.'}`
        : run.error
          ? `The run failed before a specific endpoint failure was captured. Error: ${run.error}`
          : 'The run failed, but no endpoint-specific failure detail was captured.';

      return asTextResult({
        runId: run.id,
        status: run.status,
        explanation,
        runTtl: ttlInfo('run', run.expiresAt)
      });
    }
  );

  server.registerTool(
    'save_flow',
    {
      title: 'Save Flow',
      description:
        'Persist a validated flow draft to the database and return the created test flow.',
      inputSchema: {
        sessionId: z.string().optional(),
        draftId: z.string().optional(),
        flowDocument: z.unknown().optional(),
        flowId: z.number().optional(),
        projectId: z.number().optional(),
        saveMode: z.enum(['auto', 'update', 'create_new']).optional(),
        deleteDraftAfterSave: z.boolean().optional()
      }
    },
    async ({
      sessionId,
      draftId,
      flowDocument,
      flowId,
      projectId,
      saveMode = 'auto',
      deleteDraftAfterSave = true
    }) => {
      const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
      const runnableDocument = await ensureFlowHasApiHosts(resolved.flowDocument, authContext);
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
      const session = sessionId ? getFlowSession(sessionId, user.userId) : null;
      if (sessionId && !session) {
        throw new Error(`Flow session ${sessionId} was not found.`);
      }
      const resolvedProjectId = projectId ?? runnableDocument.projectId;
      const resolvedEnvironmentId =
        runnableDocument.environmentId ??
        runnableDocument.flowData.settings.environment?.environmentId ??
        runnableDocument.flowData.settings.linkedEnvironment?.environmentId;
      const targetFlowId = flowId ?? runnableDocument.sourceFlowId ?? session?.sourceFlowId;
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

      if (resolved.draftId && deleteDraftAfterSave) {
        deleteDraft(resolved.draftId, user.userId);
      }

      if (sessionId) {
        updateFlowSession(sessionId, user.userId, {
          sourceFlowId: result.testFlow.id,
          status: 'saved'
        });
      }

      const explanation = explainFlowDocument(runnableDocument);

      return asTextResult({
        sessionId: sessionId ?? null,
        draftId: resolved.draftId,
        saveMode: shouldUpdate ? 'updated_existing' : 'created_new',
        flowId: result.testFlow.id,
        validation,
        explanation,
        projectId: resolvedProjectId ?? null,
        environmentId: resolvedEnvironmentId ?? null,
        apiHosts: runnableDocument.flowData.settings.api_hosts ?? {},
        testFlow: result.testFlow
      });
    }
  );

  server.registerTool(
    'list_flow_sequences',
    {
      title: 'List Flow Sequences',
      description:
        'List flow sequences for a project or one module so an agent can compose self-contained flows.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number().optional()
      }
    },
    async ({ projectId, moduleId }) => {
      const user = requireAuthContext(authContext);
      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const result = moduleId
        ? await service.listModuleSequences(moduleId, projectId, user.userId)
        : await service.listProjectSequences(projectId, user.userId);
      return asTextResult(result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    'get_flow_sequence',
    {
      title: 'Get Flow Sequence',
      description: 'Load a flow sequence, including ordered flow steps and parameter mappings.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number(),
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
        moduleId: z.number(),
        sequenceId: z.number(),
        testFlowId: z.number(),
        stepOrder: z.number(),
        parameterMappings: z
          .array(
            z.object({
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
              source_output_field: z.string().optional()
            })
          )
          .optional()
      }
    },
    async ({ projectId, moduleId, sequenceId, testFlowId, stepOrder, parameterMappings = [] }) => {
      const user = requireAuthContext(authContext);
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const existingFlow = await getTestFlow(testFlowId, user.userId);
      if (!existingFlow) {
        throw new Error(`Test flow ${testFlowId} was not found.`);
      }

      const { FlowSequenceService } = await import('$lib/server/service/projects/sequence_service');
      const service = new FlowSequenceService();
      const sequence = await service.addFlowToSequence(
        sequenceId,
        moduleId,
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
        moduleId: z.number(),
        sequenceId: z.number(),
        sequenceStepId: z.string().optional(),
        stepOrder: z.number().optional(),
        mapping: z.object({
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
          source_output_field: z.string().optional()
        })
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
        'Enable, update, or disable loop mode for one sequence step. Loop sources are fixed count, environment array variables, or array outputs from previous steps. After enabling loop mode, use set_sequence_parameter_mapping with source_type loop_value to pass the current iteration value into the flow.',
      inputSchema: {
        projectId: z.number(),
        moduleId: z.number(),
        sequenceId: z.number(),
        sequenceStepId: z.string().optional(),
        stepOrder: z.number().optional(),
        loopConfig: z.object({
          enabled: z.boolean(),
          source_type: z.enum([
            'fixed_count',
            'environment_variable_array',
            'previous_output_array'
          ]),
          count: z.number().optional(),
          source_value: z.string().optional(),
          source_flow_step: z.number().optional(),
          source_output_field: z.string().optional()
        })
      }
    },
    async ({ projectId, moduleId, sequenceId, sequenceStepId, stepOrder, loopConfig }) => {
      const sequence = await getSequenceForMcp({ projectId, moduleId, sequenceId }, authContext);
      const updatedSequence = setSequenceLoopConfig(sequence, {
        sequenceStepId,
        stepOrder,
        loopConfig
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
        moduleId: z.number(),
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
        moduleId: z.number(),
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
        projects: result.projects
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
      return asTextResult({
        project: context.project,
        apis: context.apis,
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
        'Search imported API endpoints within the selected project API scope. Pass apiIds directly, or pass draftId/sessionId to inherit selected scope. If you are working in the backend codebase, use that context first to choose likely APIs, tags, paths, and endpoint names. If a project has multiple APIs and none are selected yet, ask the human to clarify first.',
      inputSchema: {
        userId: z.number().optional(),
        query: z.string(),
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        limit: z.number().min(1).max(50).default(10)
      }
    },
    async ({ userId, query, draftId, sessionId, projectId, apiId, apiIds, limit }) => {
      const scopedApis = await resolveApiScope(
        { draftId, sessionId, projectId, apiId, apiIds },
        authContext
      );
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
        draftId: draftId ?? null,
        sessionId: sessionId ?? null,
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
        'Browse endpoints by API, tag, or path prefix within the selected project API scope. Pass apiIds directly, or pass draftId/sessionId to inherit selected scope. If you are working in the backend codebase, use code-level context to pick the right API, tags, and path prefixes before browsing. If a project has multiple APIs and none are selected yet, ask the human to clarify first.',
      inputSchema: {
        userId: z.number().optional(),
        draftId: z.string().optional(),
        sessionId: z.string().optional(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        tag: z.string().optional(),
        pathPrefix: z.string().optional(),
        limit: z.number().min(1).max(100).optional()
      }
    },
    async ({
      userId,
      draftId,
      sessionId,
      projectId,
      apiId,
      apiIds,
      tag,
      pathPrefix,
      limit = 50
    }) => {
      const scopedApis = await resolveApiScope(
        { draftId, sessionId, projectId, apiId, apiIds },
        authContext
      );
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
        draftId: draftId ?? null,
        sessionId: sessionId ?? null,
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
      description: 'Find reusable test flows before generating a new one.',
      inputSchema: {
        userId: z.number().optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
        search: z.string().optional(),
        projectId: z.number().optional()
      }
    },
    async ({ userId, page, limit, search, projectId }) => {
      const { getTestFlowsForUser } = await import(
        '$lib/server/service/test_flows/list_test_flows'
      );
      const flows = await getTestFlowsForUser(getUserId(userId, authContext), {
        page,
        limit,
        search,
        projectId
      });
      return asTextResult(flows as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    'get_test_flow',
    {
      title: 'Get Test Flow',
      description: 'Load an existing test flow along with the endpoints it uses.',
      inputSchema: {
        userId: z.number().optional(),
        id: z.number()
      }
    },
    async ({ userId, id }) => {
      const { getTestFlow } = await import('$lib/server/service/test_flows/get_test_flow');
      const result = await getTestFlow(id, getUserId(userId, authContext));
      if (!result) {
        throw new Error(`Test flow ${id} was not found.`);
      }
      return asTextResult(result as unknown as Record<string, unknown>);
    }
  );

  return server;
}
