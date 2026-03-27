import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { isValidOperator } from '$lib/assertions';
import {
  addAssertionToFlow,
  addFlowParameter,
  addStepToFlow,
  createFlowDraft,
  explainFlowDocument,
  linkEnvironmentToFlow,
  linkStepOutput,
  setBodyField,
  setQueryParam,
  type FlowDocument,
  validateFlowDocument
} from '$lib/mcp/flow';
import { createDraft, deleteDraft, getDraft, updateDraft } from '$lib/mcp/drafts';
import {
  explainAssertion,
  explainTemplateExpression,
  explainTransformationExpression,
  suggestTemplateExpression
} from '$lib/mcp/explain';

export interface McpAuthContext {
  userId: number;
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

function getUserId(inputUserId: number | undefined, authContext?: McpAuthContext): number {
  const resolved = authContext?.userId ?? inputUserId ?? Number(process.env.TEST_PILOT_USER_ID);
  if (!resolved || Number.isNaN(resolved)) {
    throw new Error('userId is required for database-backed tools. Pass userId explicitly or set TEST_PILOT_USER_ID.');
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
      throw new Error(`Draft ${args.draftId} was not found.`);
    }
    return { draftId: draft.id, flowDocument: draft.document };
  }

  if (!args.flowDocument) {
    throw new Error('Either draftId or flowDocument is required.');
  }

  return { flowDocument: args.flowDocument as FlowDocument };
}

function extractApiIds(document: FlowDocument): number[] {
  const apiIds = new Set<number>();

  for (const step of document.flowData.steps) {
    for (const endpoint of step.endpoints) {
      const numericApiId = typeof endpoint.api_id === 'string' ? Number(endpoint.api_id) : endpoint.api_id;
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

function requireApiScope(input: { apiId?: number; apiIds?: number[] }): { apiId?: number; apiIds?: number[] } {
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
  input: { apiId?: number; apiIds?: number[]; draftId?: string; projectId?: number },
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

async function resolveDraftSelections(
  input: { projectId?: number; apiIds?: number[]; environmentId?: number },
  authContext?: McpAuthContext
): Promise<{ apiIds?: number[]; environmentId?: number }> {
  if (!input.projectId) {
    return { apiIds: input.apiIds, environmentId: input.environmentId };
  }

  const detail = await getProjectDetailForUser(input.projectId, authContext);
  const projectApiIds = new Set(detail.apis.map((api) => api.apiId));
  const projectEnvironmentIds = new Set(detail.environments.map((environment) => environment.environmentId));
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
}) {
  if (isValidOperator(assertion.operator)) {
    return assertion;
  }

  const operatorAliasMap: Record<string, { operator: string; expected_value?: unknown }> = {
    is_number: { operator: 'is_type', expected_value: 'number' },
    is_string: { operator: 'is_type', expected_value: 'string' },
    is_boolean: { operator: 'is_type', expected_value: 'boolean' },
    is_array: { operator: 'is_type', expected_value: 'array' },
    is_object: { operator: 'is_type', expected_value: 'object' }
  };

  const alias = operatorAliasMap[assertion.operator];
  if (!alias) {
    throw new Error(`Unknown assertion operator "${assertion.operator}". Supported operators do not include it. For type checks, use operator "is_type" with expected_value like "number".`);
  }

  return {
    ...assertion,
    operator: alias.operator,
    expected_value: alias.expected_value ?? assertion.expected_value
  };
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
    const apiHosts = Object.fromEntries(
      detail.apis
        .filter((apiLink) => apiIds.includes(apiLink.apiId))
        .map((apiLink) => [
          String(apiLink.apiId),
          {
            url: apiLink.defaultHost ?? apiLink.api?.host ?? '',
            name: apiLink.api?.name ?? `API ${apiLink.apiId}`
          }
        ])
        .filter(([, host]) => host.url)
    );

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

export function createTestPilotMcpServer(authContext?: McpAuthContext): McpServer {
  const server = new McpServer({
    name: 'test-pilot-mcp',
    version: '0.1.0'
  });

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
        return asTextResult({ explanation: explainAssertion(assertion) });
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
      description: 'Build canonical Test-Pilot template syntax from structured input and explain it.',
      inputSchema: {
        source: z.enum(['res', 'proc', 'param', 'func', 'env']),
        preserveType: z.boolean().optional(),
        stepEndpointRef: z.string().optional(),
        endpointIndex: z.number().optional(),
        jsonPath: z.string().optional(),
        alias: z.string().optional(),
        nestedPath: z.string().optional(),
        parameterName: z.string().optional(),
        environmentName: z.string().optional(),
        functionName: z.string().optional(),
        functionArgs: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
      }
    },
    async (input) => asTextResult(suggestTemplateExpression(input))
  );

  server.registerTool(
    'create_flow_draft',
    {
      title: 'Create Flow Draft',
      description: 'Create a new stateful Test-Pilot flow draft. If the selected project has multiple APIs or environments and the human did not specify which ones to use, stop and ask for clarification before calling this tool.',
      inputSchema: {
      name: z.string(),
      description: z.string().optional(),
      projectId: z.number().optional(),
      apiIds: z.array(z.number()).optional(),
      environmentId: z.number().optional(),
      apiHosts: z.record(z.string(), z.object({ url: z.string(), name: z.string().optional() })).optional(),
      parameters: z.array(z.object({
          name: z.string(),
          type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
          value: z.unknown().optional(),
          defaultValue: z.unknown().optional(),
          description: z.string().optional(),
          required: z.boolean()
      })).optional()
    }
  },
  async ({ name, description, projectId, apiIds, environmentId, apiHosts, parameters }) => {
    const resolvedSelections = await resolveDraftSelections({ projectId, apiIds, environmentId }, authContext);
    const flowDocument = createFlowDraft({
      name,
      description,
      projectId,
      apiIds: resolvedSelections.apiIds,
      environmentId: resolvedSelections.environmentId,
      apiHosts,
      parameters
    });
    const user = requireAuthContext(authContext);
    const draft = createDraft(user.userId, flowDocument);
    return asTextResult({
      draftId: draft.id,
      flowDocument,
      selectionSummary: {
        projectId: flowDocument.projectId ?? null,
        apiIds: flowDocument.apiIds ?? [],
        environmentId: flowDocument.environmentId ?? null
      },
      templateSyntaxGuide: {
        parameters: 'Use {{param:name}} to reference a flow parameter. Bare {{name}} is not valid.',
        responses: 'Use {{res:stepId-0.$.path}} for a response reference.',
        transformations: 'Use {{proc:stepId-0.$.alias}} for a transformation alias.'
      }
    });
  }
);

server.registerTool(
  'get_draft',
  {
    title: 'Get Draft',
    description: 'Load the current server-side draft document by draftId so an agent can recover context mid-session.',
    inputSchema: {
      draftId: z.string()
    }
  },
  async ({ draftId }) => {
    const user = requireAuthContext(authContext);
    const draft = getDraft(draftId, user.userId);
    if (!draft) {
      throw new Error(`Draft ${draftId} was not found.`);
    }

    return asTextResult({
      draftId: draft.id,
      flowDocument: draft.document,
      selectionSummary: {
        projectId: draft.document.projectId ?? null,
        apiIds: draft.document.apiIds ?? [],
        environmentId: draft.document.environmentId ?? null
      }
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
        endpoints: z.array(z.object({
          endpoint_id: z.union([z.string(), z.number()]),
          api_id: z.union([z.string(), z.number()]),
          order: z.number().optional(),
          pathParams: z.record(z.string(), z.string()).optional(),
          queryParams: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
          body: z.unknown().optional(),
          headers: z.array(z.object({
            name: z.string(),
            value: z.string(),
            enabled: z.boolean()
          })).optional(),
          transformations: z.array(z.object({
            alias: z.string(),
            expression: z.string()
          })).optional(),
          assertions: z.array(z.object({
            id: z.string(),
            data_source: z.enum(['response', 'transformed_data']),
            assertion_type: z.enum(['status_code', 'response_time', 'header', 'json_body']),
            data_id: z.string(),
            operator: z.string(),
            expected_value: z.unknown(),
            enabled: z.boolean(),
            is_template_expression: z.boolean().optional()
          })).optional(),
          skipDefaultStatusCheck: z.boolean().optional()
        })).optional(),
        timeout: z.number().optional(),
      clearCookiesBeforeExecution: z.boolean().optional()
    }
  },
  async ({ draftId, flowDocument, ...stepInput }) => {
    const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
    const updated = addStepToFlow(resolved.flowDocument, stepInput);
    if (resolved.draftId) {
      const user = requireAuthContext(authContext);
      updateDraft(resolved.draftId, user.userId, updated);
    }
    return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
  }
  );

server.registerTool(
  'add_flow_parameter',
  {
    title: 'Add Flow Parameter',
    description: 'Add or update a single flow parameter on the draft.',
    inputSchema: {
      draftId: z.string().optional(),
      flowDocument: z.unknown().optional(),
      parameter: z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
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
  'link_environment_to_flow',
  {
    title: 'Link Environment To Flow',
    description: 'Link a project environment to the flow and map environment variables to flow parameters.',
    inputSchema: {
      draftId: z.string().optional(),
      flowDocument: z.unknown().optional(),
      environmentId: z.number(),
      environmentName: z.string(),
      selectedSubEnvironment: z.string().optional(),
      parameterMappings: z.record(z.string(), z.string()).optional()
    }
  },
  async ({ draftId, flowDocument, environmentId, environmentName, selectedSubEnvironment, parameterMappings }) => {
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
      const updated = setBodyField(resolved.flowDocument, { stepId, endpointIndex, fieldPath, value });
      if (resolved.draftId) {
        const user = requireAuthContext(authContext);
        updateDraft(resolved.draftId, user.userId, updated);
      }
      return asTextResult({ draftId: resolved.draftId, flowDocument: updated });
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
    'link_step_output',
    {
      title: 'Link Step Output',
      description: 'Wire a response or transformation output from one step into a field on a later step.',
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
    description: 'Validate structure, references, and common expression risks for a stateless flow draft.',
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
    'explain_flow',
    {
      title: 'Explain Flow',
    description: 'Explain a complete flow draft step-by-step, including dependencies and warnings.',
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
  'save_flow',
  {
    title: 'Save Flow',
    description: 'Persist a validated flow draft to the database and return the created test flow.',
    inputSchema: {
      draftId: z.string().optional(),
      flowDocument: z.unknown().optional(),
      projectId: z.number().optional(),
      deleteDraftAfterSave: z.boolean().optional()
    }
  },
  async ({ draftId, flowDocument, projectId, deleteDraftAfterSave = true }) => {
    const resolved = resolveDraftOrDocument({ draftId, flowDocument }, authContext);
    const runnableDocument = await ensureFlowHasApiHosts(resolved.flowDocument, authContext);
    const validation = validateFlowDocument(runnableDocument);
    if (!validation.valid) {
      throw new Error(`Flow is not valid and cannot be saved: ${validation.errors.join('; ')}`);
    }

    const apiIds = extractApiIds(runnableDocument);
    if (apiIds.length === 0) {
      throw new Error('Could not determine any API ids from the flow. Add endpoints before saving.');
    }

    const { createBasicTestFlow } = await import('$lib/server/service/test_flows/create_test_flow');
    const user = requireAuthContext(authContext);
    const resolvedProjectId = projectId ?? runnableDocument.projectId;
    const resolvedEnvironmentId =
      runnableDocument.environmentId ??
      runnableDocument.flowData.settings.environment?.environmentId ??
      runnableDocument.flowData.settings.linkedEnvironment?.environmentId;
    const result = await createBasicTestFlow(user.userId, {
      name: runnableDocument.name,
      description: runnableDocument.description,
      apiIds,
      projectId: resolvedProjectId,
      environmentId: resolvedEnvironmentId ?? undefined,
      flowJson: runnableDocument.flowData
    });

    if (resolved.draftId && deleteDraftAfterSave) {
      deleteDraft(resolved.draftId, user.userId);
    }

    const explanation = explainFlowDocument(runnableDocument);

    return asTextResult({
      draftId: resolved.draftId,
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
    'list_projects',
    {
      title: 'List Projects',
      description: 'List the authenticated user projects so an agent can choose the right project id before saving a flow.',
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
      description: 'Get the APIs and environments linked to a project, including environment variables and mappings, for flow generation. Agents should use this before create_flow_draft and ask the human to clarify when the project has multiple APIs or multiple environments.',
      inputSchema: {
        projectId: z.number(),
        includeEnvironmentValues: z.boolean().optional()
      }
    },
    async ({ projectId, includeEnvironmentValues = true }) => {
      const user = requireAuthContext(authContext);
      const { ProjectService } = await import('$lib/server/service/projects/project_service');
      const { ProjectEnvironmentService } = await import('$lib/server/service/projects/environment_service');
      const { ProjectEnvironmentMappingService } = await import('$lib/server/service/projects/project_environment_mapping_service');

      const projectService = new ProjectService();
      const environmentService = new ProjectEnvironmentService();
      const environmentMappingService = new ProjectEnvironmentMappingService();

      const detail = await projectService.getProjectDetail(projectId, user.userId);
      const linkedEnvironments = await environmentService.listProjectEnvironments(projectId, user.userId);
      const environmentMappings = await environmentMappingService.getEnvironmentMappings(projectId, user.userId);

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
                Object.entries(environmentConfig?.environments ?? {}).map(([subEnvName, subEnvConfig]) => [
                  subEnvName,
                  {
                    variables: subEnvConfig.variables ?? {},
                    apiHosts: subEnvConfig.api_hosts ?? {}
                  }
                ])
              )
            : undefined,
          linkedApiIds: environmentConfig?.linked_apis ?? [],
          parameterMappings: mapping?.variable_mappings ?? {}
        };
      });

      return asTextResult({
        project: {
          id: detail.project.id,
          name: detail.project.name,
          description: detail.project.description ?? null
        },
        apis: detail.apis.map((apiLink) => ({
          id: apiLink.apiId,
          name: apiLink.api?.name ?? '',
          description: apiLink.api?.description ?? null,
          defaultHost: apiLink.defaultHost ?? apiLink.api?.host ?? null
        })),
        environments,
        counts: {
          apis: detail.apis.length,
          environments: environments.length,
          modules: detail.modules.length
        },
        agentGuidance: {
          clarificationRequired: detail.apis.length > 1 || environments.length > 1,
          notes: [
            detail.apis.length > 1
              ? 'This project has multiple APIs. Ask the human which APIs should be in scope before creating the flow draft or searching endpoints.'
              : 'This project has a single linked API, so the MCP can infer API scope if needed.',
            environments.length > 1
              ? 'This project has multiple environments. Ask the human which environment to link to the flow before creating the draft.'
              : environments.length === 1
                ? 'This project has a single linked environment, so the MCP can infer the environment if the human does not specify one.'
                : 'This project has no linked environments. The flow may need API Hosts configured directly.'
          ]
        }
      });
    }
  );

  server.registerTool(
    'search_endpoints',
    {
      title: 'Search Endpoints',
      description: 'Search imported API endpoints within the selected project API scope. Pass apiIds directly, or pass draftId to inherit the draft API scope. If a project has multiple APIs and none are selected yet, ask the human to clarify first.',
      inputSchema: {
        userId: z.number().optional(),
        query: z.string(),
        draftId: z.string().optional(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        limit: z.number().min(1).max(50).default(10)
    }
  },
  async ({ userId, query, draftId, projectId, apiId, apiIds, limit }) => {
      const scopedApis = await resolveApiScope({ draftId, projectId, apiId, apiIds }, authContext);
      const { searchEndpointsByDescription } = await import('$lib/server/service/api_endpoints/search_endpoints');
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
        searchMode: endpoints.length > 0 ? 'full_text' : fallbackEndpoints.length > 0 ? 'metadata_fallback' : 'none',
        draftId: draftId ?? null,
        projectId: projectId ?? null,
        apiScope: scopedApis.apiId ? [scopedApis.apiId] : scopedApis.apiIds ?? [],
        note
      });
    }
  );

  server.registerTool(
    'browse_endpoints',
    {
      title: 'Browse Endpoints',
      description: 'Browse endpoints by API, tag, or path prefix within the selected project API scope. Pass apiIds directly, or pass draftId to inherit the draft API scope. If a project has multiple APIs and none are selected yet, ask the human to clarify first.',
      inputSchema: {
        userId: z.number().optional(),
        draftId: z.string().optional(),
        projectId: z.number().optional(),
        apiId: z.number().optional(),
        apiIds: z.array(z.number()).optional(),
        tag: z.string().optional(),
        pathPrefix: z.string().optional(),
        limit: z.number().min(1).max(100).optional()
    }
  },
  async ({ userId, draftId, projectId, apiId, apiIds, tag, pathPrefix, limit = 50 }) => {
      const scopedApis = await resolveApiScope({ draftId, projectId, apiId, apiIds }, authContext);
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
        projectId: projectId ?? null,
        apiScope: scopedApis.apiId ? [scopedApis.apiId] : scopedApis.apiIds ?? []
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
      const { getEndpointDetails, getEndpointSummary } = await import('$lib/server/service/api_endpoints/get_endpoint_details');
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
      const { getTestFlowsForUser } = await import('$lib/server/service/test_flows/list_test_flows');
      const flows = await getTestFlowsForUser(getUserId(userId, authContext), { page, limit, search, projectId });
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
