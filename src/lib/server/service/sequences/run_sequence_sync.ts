import { SequenceRunner } from '$lib/sequence-runner';
import type { SequenceRunnerOptions, SequenceFlowResult } from '$lib/sequence-runner/types';
import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';
import type { TestFlow } from '$lib/types/test-flow';
import { getTestFlow } from '$lib/server/service/test_flows/get_test_flow';
import { getEnvironmentByIdAndUserId } from '$lib/server/repository/db/environment';
import { serverFlowHttpTransport } from '$lib/server/service/test_flows/server_flow_http_transport';
import { FlowSequenceService } from '$lib/server/service/projects/sequence_service';
import { ProjectRepository } from '$lib/server/repository/db/project';
import { db } from '$lib/server/db';
import { flowSequences, projectModules } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export class SequenceRunError extends Error {
  constructor(
    message: string,
    public statusCode = 500
  ) {
    super(message);
    this.name = 'SequenceRunError';
  }
}

export interface RunSequenceSyncInput {
  environment: {
    environmentId: number;
    subEnvironment: string;
  };
  preferences?: Partial<ExecutionPreferences>;
}

export interface RunSequenceSyncResult {
  status: 'completed' | 'failed' | 'error';
  success: boolean;
  summary: string;
  sequenceId: number;
  sequenceName: string;
  totalFlows: number;
  completedFlows: number;
  flowResults: SequenceFlowResult[];
  logs: Array<{ level: string; message: string; details?: string }>;
  error?: string;
}

export async function runSequenceSync(
  sequenceId: number,
  userId: number,
  input: RunSequenceSyncInput
): Promise<RunSequenceSyncResult> {
  // Resolve moduleId and projectId via DB join
  const [row] = await db
    .select({
      moduleId: flowSequences.moduleId,
      projectId: projectModules.projectId
    })
    .from(flowSequences)
    .innerJoin(projectModules, eq(flowSequences.moduleId, projectModules.id))
    .where(eq(flowSequences.id, sequenceId))
    .limit(1);

  if (!row) {
    throw new SequenceRunError('Sequence not found', 404);
  }

  const { moduleId, projectId } = row;

  // Auth-gated fetch via service
  const sequenceService = new FlowSequenceService();
  let sequence;
  try {
    sequence = await sequenceService.getFlowSequence(sequenceId, moduleId, projectId, userId);
  } catch {
    throw new SequenceRunError('Sequence not found or access denied', 404);
  }

  // Fetch environment
  const environment = await getEnvironmentByIdAndUserId(
    input.environment.environmentId,
    userId
  );
  if (!environment) {
    throw new SequenceRunError('Environment not found or access denied', 404);
  }

  // Fetch project (required by SequenceRunnerOptions type)
  const projectRepo = new ProjectRepository();
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new SequenceRunError('Project not found or access denied', 404);
  }

  // Build flows array: one entry per step (in step_order), matching browser behavior
  const orderedSteps = [...(sequence.sequenceConfig.steps ?? [])].sort(
    (a, b) => a.step_order - b.step_order
  );

  const flowCache = new Map<number, TestFlow>();
  for (const step of orderedSteps) {
    if (!flowCache.has(step.test_flow_id)) {
      const result = await getTestFlow(step.test_flow_id, userId);
      if (result?.testFlow) {
        flowCache.set(step.test_flow_id, result.testFlow as unknown as TestFlow);
      }
    }
  }

  const flows: TestFlow[] = [];
  for (const step of orderedSteps) {
    const flow = flowCache.get(step.test_flow_id);
    if (flow) flows.push(flow);
  }

  const logs: RunSequenceSyncResult['logs'] = [];
  // Use a container object to avoid TypeScript narrowing issues with callback assignment
  const state = {
    success: false,
    error: undefined as unknown,
    completedFlows: 0,
    totalFlows: flows.length,
    flowResults: [] as SequenceFlowResult[]
  };

  const preferences: ExecutionPreferences = {
    parallelExecution: input.preferences?.parallelExecution ?? false,
    stopOnError: input.preferences?.stopOnError ?? true,
    serverCookieHandling: false,
    retryCount: input.preferences?.retryCount ?? 0,
    timeout: input.preferences?.timeout ?? 30000
  };

  const options: SequenceRunnerOptions = {
    sequence,
    flows,
    project,
    selectedEnvironment: environment,
    selectedSubEnvironment: input.environment.subEnvironment,
    preferences,
    httpTransport: serverFlowHttpTransport,
    onLog: (level, message, details) => {
      logs.push({ level, message, details });
    },
    onSequenceComplete: (data) => {
      state.success = data.success;
      state.error = data.error;
      state.completedFlows = data.completedFlows;
      state.totalFlows = data.totalFlows;
      state.flowResults = data.flowResults;
    }
  };

  try {
    const runner = new SequenceRunner(options);
    await runner.runSequence();

    // Use runner.flowResults as the authoritative list (populated incrementally)
    const flowResults = runner.flowResults;

    return {
      status: state.success ? 'completed' : 'failed',
      success: state.success,
      summary: state.success
        ? `Sequence "${sequence.name}" completed: ${state.completedFlows}/${state.totalFlows} flows`
        : `Sequence "${sequence.name}" failed: ${state.completedFlows}/${state.totalFlows} flows completed`,
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      totalFlows: state.totalFlows,
      completedFlows: state.completedFlows,
      flowResults,
      logs,
      error: state.success
        ? undefined
        : state.error instanceof Error
          ? state.error.message
          : String(state.error ?? 'Unknown error')
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sequence execution failed';
    logs.push({ level: 'error', message });
    return {
      status: 'error',
      success: false,
      summary: `Sequence "${sequence.name}" encountered an error`,
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      totalFlows: state.totalFlows,
      completedFlows: state.completedFlows,
      flowResults: state.flowResults,
      logs,
      error: message
    };
  }
}
