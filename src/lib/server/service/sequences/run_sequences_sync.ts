import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';
import {
  runSequenceSync,
  SequenceRunError,
  type RunSequenceSyncResult
} from './run_sequence_sync';
import { FlowSequenceService } from '$lib/server/service/projects/sequence_service';
import { ProjectRepository } from '$lib/server/repository/db/project';
import { ProjectModuleRepository } from '$lib/server/repository/db/project_module';

export interface RunSequencesSyncInput {
  environment: {
    environmentId: number;
    subEnvironment: string;
  };
  preferences?: Partial<ExecutionPreferences>;
  mode?: 'sequential' | 'parallel';
}

export interface RunSequencesSyncResult {
  success: boolean;
  summary: string;
  totalSequences: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  results: RunSequenceSyncResult[];
}

export async function runSequencesByIds(
  sequenceIds: number[],
  userId: number,
  input: RunSequencesSyncInput
): Promise<RunSequencesSyncResult> {
  const mode = input.mode ?? 'sequential';

  let settled: PromiseSettledResult<RunSequenceSyncResult>[];

  if (mode === 'parallel') {
    settled = await Promise.allSettled(
      sequenceIds.map((id) => runSequenceSync(id, userId, input))
    );
  } else {
    settled = [];
    for (const id of sequenceIds) {
      settled.push(await Promise.allSettled([runSequenceSync(id, userId, input)]).then((r) => r[0]));
    }
  }

  const results: RunSequenceSyncResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      const message = s.reason instanceof Error ? s.reason.message : String(s.reason);
      results.push({
        status: 'error',
        success: false,
        summary: `Sequence run failed: ${message}`,
        sequenceId: sequenceIds[i],
        sequenceName: `Sequence #${sequenceIds[i]}`,
        totalFlows: 0,
        completedFlows: 0,
        flowResults: [],
        logs: [{ level: 'error', message }],
        error: message
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return {
    success: failCount === 0,
    summary: `${successCount} passed, ${failCount} failed out of ${results.length} sequences`,
    totalSequences: results.length,
    successCount,
    failCount,
    skippedCount: 0,
    results
  };
}

export async function runSequencesByModuleId(
  moduleId: number,
  projectId: number,
  userId: number,
  input: RunSequencesSyncInput
): Promise<RunSequencesSyncResult> {
  const projectRepo = new ProjectRepository();
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new SequenceRunError('Project not found or access denied', 404);
  }

  const moduleRepo = new ProjectModuleRepository();
  const module = await moduleRepo.getProjectModule(moduleId, projectId);
  if (!module) {
    throw new SequenceRunError('Module not found', 404);
  }

  const sequenceService = new FlowSequenceService();
  const { sequences } = await sequenceService.listModuleSequences(moduleId, projectId, userId);

  const runnableIds: number[] = [];
  let skippedCount = 0;

  for (const seq of sequences) {
    const stepCount = seq.sequenceConfig?.steps?.length ?? 0;
    if (stepCount > 0) {
      runnableIds.push(seq.id);
    } else {
      skippedCount++;
    }
  }

  if (runnableIds.length === 0) {
    return {
      success: true,
      summary: `No runnable sequences in module (${skippedCount} empty sequences skipped)`,
      totalSequences: 0,
      successCount: 0,
      failCount: 0,
      skippedCount,
      results: []
    };
  }

  const batchResult = await runSequencesByIds(runnableIds, userId, input);

  return {
    ...batchResult,
    skippedCount,
    summary: `${batchResult.successCount} passed, ${batchResult.failCount} failed out of ${batchResult.totalSequences} sequences${skippedCount > 0 ? ` (${skippedCount} empty sequences skipped)` : ''}`
  };
}
