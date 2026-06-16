import type {
  ExecutionState,
  FlowParameter,
  TestFlowData
} from '$lib/components/test-flows/types';
import {
  FlowRunner,
  sanitizeExecutionState,
  type ExecutionPreferences
} from '$lib/flow-runner';
import type { Environment } from '$lib/types/environment';
import { getEnvironmentByIdAndUserId } from '$lib/server/repository/db/environment';
import { getTestFlow } from './get_test_flow';
import { resolveEnvironmentVariables } from '../environments/resolve_environment_variables';
import { serverFlowHttpTransport } from './server_flow_http_transport';

export type SyncRunStatus = 'completed' | 'failed' | 'missing_parameters';
export type FlowRunLogLevel = 'info' | 'debug' | 'error' | 'warning';

export interface RunTestFlowSyncInput {
  parameters?: Record<string, unknown>;
  environment?: {
    environmentId?: number;
    subEnvironment?: string;
  };
  preferences?: Partial<ExecutionPreferences>;
}

export interface RunTestFlowSyncResult {
  status: SyncRunStatus;
  success: boolean;
  summary: string;
  executionState: ExecutionState;
  storedResponses: Record<string, unknown>;
  storedTransformations: Record<string, Record<string, unknown>>;
  parameterValues: Record<string, unknown>;
  flowOutputs: Record<string, unknown>;
  logs: Array<{ level: FlowRunLogLevel; message: string; details?: string }>;
  missingParameters?: string[];
  error?: string;
}

export class TestFlowRunError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TestFlowRunError';
  }
}

interface EnvironmentState {
  environment: Environment;
  resolvedVariables: Record<string, unknown>;
}

export async function runTestFlowSync(
  testFlowId: number,
  userId: number,
  input: RunTestFlowSyncInput = {}
): Promise<RunTestFlowSyncResult> {
  const result = await getTestFlow(testFlowId, userId);
  if (!result) {
    throw new TestFlowRunError('Test flow not found or does not belong to the user', 404);
  }

  let flowData = cloneFlowData({
    ...result.testFlow.flowJson,
    endpoints: result.testFlow.endpoints ?? result.testFlow.flowJson.endpoints ?? []
  });

  return runFlowDataSync(flowData, userId, input, {
    projectId: result.testFlow.projectId,
    savedEnvironmentId: result.testFlow.environmentId
  });
}

export async function runFlowDataSync(
  rawFlowData: TestFlowData,
  userId: number,
  input: RunTestFlowSyncInput = {},
  context: { projectId?: number | null; savedEnvironmentId?: number | null } = {}
): Promise<RunTestFlowSyncResult> {
  let flowData = await ensureFlowHasApiHosts(
    cloneFlowData(rawFlowData),
    context.projectId ?? null,
    userId
  );
  flowData = applyParameterOverrides(flowData, input.parameters);
  flowData = applyEnvironmentSelection(
    flowData,
    context.savedEnvironmentId ?? null,
    input.environment
  );

  const environmentState = await loadSelectedEnvironment(
    flowData,
    context.savedEnvironmentId ?? null,
    userId,
    input.environment
  );

  const logs: RunTestFlowSyncResult['logs'] = [];
  let executionState: ExecutionState = {};
  let completionData: {
    success: boolean;
    error?: unknown;
    storedResponses: Record<string, unknown>;
    storedTransformations: Record<string, Record<string, unknown>>;
    executionState: ExecutionState;
    parameterValues: Record<string, unknown>;
    flowOutputs: Record<string, unknown>;
  } | null = null;

  const runner = new FlowRunner({
    flowData,
    preferences: {
      parallelExecution: input.preferences?.parallelExecution ?? false,
      stopOnError: input.preferences?.stopOnError ?? true,
      serverCookieHandling: input.preferences?.serverCookieHandling ?? false,
      retryCount: input.preferences?.retryCount ?? 0,
      timeout: input.preferences?.timeout ?? 30000
    },
    httpTransport: serverFlowHttpTransport,
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
      executionState = data.executionState;
    }
  });

  const runResult = await runner.runFlow();

  if (runResult.parametersWithMissingValues?.length) {
    return buildMissingParametersResult(
      runResult.parametersWithMissingValues,
      runner.parameterValues,
      logs
    );
  }

  const finalCompletion = completionData ?? {
    success: runResult.success,
    error: runResult.error,
    storedResponses: runner.storedResponses,
    storedTransformations: runner.storedTransformations,
    executionState: runner.executionState,
    parameterValues: runner.parameterValues,
    flowOutputs: {}
  };

  const sanitizedExecutionState = sanitizeExecutionState(finalCompletion.executionState);
  const failedEndpoint = findFailedEndpoint(sanitizedExecutionState);
  const errorMessage = finalCompletion.error ? stringifyError(finalCompletion.error) : undefined;
  const success = runResult.success;

  return {
    status: success ? 'completed' : 'failed',
    success,
    summary: success
      ? `Flow executed successfully with ${flowData.steps.length} steps.`
      : failedEndpoint
        ? `Flow failed at ${failedEndpoint}.`
        : `Flow execution failed${errorMessage ? `: ${errorMessage}` : '.'}`,
    executionState: sanitizedExecutionState,
    storedResponses: finalCompletion.storedResponses,
    storedTransformations: finalCompletion.storedTransformations,
    parameterValues: finalCompletion.parameterValues,
    flowOutputs: finalCompletion.flowOutputs,
    logs,
    error: errorMessage
  };
}

function buildMissingParametersResult(
  missingParameters: FlowParameter[],
  parameterValues: Record<string, unknown>,
  logs: RunTestFlowSyncResult['logs']
): RunTestFlowSyncResult {
  const names = missingParameters.map((parameter) => parameter.name);
  return {
    status: 'missing_parameters',
    success: false,
    summary: `Flow requires parameter values for: ${names.join(', ')}.`,
    executionState: {},
    storedResponses: {},
    storedTransformations: {},
    parameterValues,
    flowOutputs: {},
    logs,
    missingParameters: names
  };
}

function cloneFlowData(flowData: TestFlowData): TestFlowData {
  return structuredClone(flowData);
}

function applyParameterOverrides(
  flowData: TestFlowData,
  parameters: Record<string, unknown> | undefined
): TestFlowData {
  if (!parameters || Object.keys(parameters).length === 0) {
    return flowData;
  }

  return {
    ...flowData,
    parameters: flowData.parameters.map((parameter) =>
      Object.prototype.hasOwnProperty.call(parameters, parameter.name)
        ? {
            ...parameter,
            defaultValue: parameters[parameter.name]
          }
        : parameter
    )
  };
}

function applyEnvironmentSelection(
  flowData: TestFlowData,
  savedEnvironmentId: number | null,
  environmentOverride: RunTestFlowSyncInput['environment']
): TestFlowData {
  const environmentId =
    environmentOverride?.environmentId ??
    flowData.settings.environment?.environmentId ??
    flowData.settings.linkedEnvironment?.environmentId ??
    savedEnvironmentId ??
    null;

  const subEnvironment =
    environmentOverride?.subEnvironment ?? flowData.settings.environment?.subEnvironment ?? null;

  return {
    ...flowData,
    settings: {
      ...flowData.settings,
      environment: {
        environmentId,
        subEnvironment
      },
      linkedEnvironment: flowData.settings.linkedEnvironment
        ? {
            ...flowData.settings.linkedEnvironment,
            environmentId: environmentId ?? flowData.settings.linkedEnvironment.environmentId
          }
        : flowData.settings.linkedEnvironment
    }
  };
}

async function loadSelectedEnvironment(
  flowData: TestFlowData,
  savedEnvironmentId: number | null,
  userId: number,
  override: RunTestFlowSyncInput['environment']
): Promise<EnvironmentState | null> {
  const environmentId =
    override?.environmentId ??
    flowData.settings.environment?.environmentId ??
    flowData.settings.linkedEnvironment?.environmentId ??
    savedEnvironmentId;

  if (!environmentId) {
    return null;
  }

  const environment = await getEnvironmentByIdAndUserId(environmentId, userId);
  if (!environment) {
    throw new TestFlowRunError(`Environment ${environmentId} was not found for this user`, 404);
  }

  const subEnvironment =
    override?.subEnvironment ??
    flowData.settings.environment?.subEnvironment ??
    Object.keys(environment.config.environments ?? {})[0];

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

async function ensureFlowHasApiHosts(
  flowData: TestFlowData,
  projectId: number | null,
  userId: number
): Promise<TestFlowData> {
  if (Object.keys(flowData.settings.api_hosts ?? {}).length > 0 || !projectId) {
    return flowData;
  }

  const apiIds = extractApiIds(flowData);
  if (apiIds.length === 0) {
    return flowData;
  }

  const { ProjectService } = await import('$lib/server/service/projects/project_service');
  const projectService = new ProjectService();
  const detail = await projectService.getProjectDetail(projectId, userId);
  const apiHosts: NonNullable<TestFlowData['settings']['api_hosts']> = {};
  for (const apiLink of detail.apis) {
    if (!apiIds.includes(apiLink.apiId)) {
      continue;
    }

    const url = apiLink.defaultHost ?? apiLink.api?.host ?? '';
    if (url) {
      apiHosts[String(apiLink.apiId)] = {
        url,
        name: apiLink.api?.name ?? `API ${apiLink.apiId}`
      };
    }
  }

  if (Object.keys(apiHosts).length === 0) {
    return flowData;
  }

  return {
    ...flowData,
    settings: {
      ...flowData.settings,
      api_hosts: apiHosts
    }
  };
}

function extractApiIds(flowData: TestFlowData): number[] {
  const apiIds = new Set<number>();
  for (const step of flowData.steps) {
    for (const endpoint of step.endpoints) {
      const apiId = typeof endpoint.api_id === 'string' ? Number(endpoint.api_id) : endpoint.api_id;
      if (typeof apiId === 'number' && !Number.isNaN(apiId)) {
        apiIds.add(apiId);
      }
    }
  }

  return [...apiIds];
}

function findFailedEndpoint(executionState: ExecutionState): string | undefined {
  return Object.entries(executionState).find(
    ([, state]) =>
      typeof state === 'object' &&
      state !== null &&
      'status' in state &&
      state.status === 'failed'
  )?.[0];
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
