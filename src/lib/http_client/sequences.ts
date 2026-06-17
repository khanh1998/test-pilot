import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';
import type { SequenceFlowResult } from '$lib/sequence-runner/types';
import { fetchWithAuth } from './util';

export interface RunSequenceSyncRequest {
  environment: {
    environmentId: number;
    subEnvironment: string;
  };
  preferences?: Partial<ExecutionPreferences>;
}

export interface RunSequenceSyncResponse {
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

export interface RunSequencesBatchRequest {
  sequenceIds?: number[];
  environment: {
    environmentId: number;
    subEnvironment: string;
  };
  preferences?: Partial<ExecutionPreferences>;
  mode?: 'sequential' | 'parallel';
}

export interface RunSequencesBatchResponse {
  success: boolean;
  summary: string;
  totalSequences: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  results: RunSequenceSyncResponse[];
}

export async function runSequenceOnBackend(
  projectId: number,
  moduleId: number,
  sequenceId: number,
  body: RunSequenceSyncRequest
): Promise<RunSequenceSyncResponse> {
  const response = await fetchWithAuth(
    `/api/projects/${projectId}/modules/${moduleId}/sequences/${sequenceId}/runs`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export async function runSequencesBatchOnBackend(
  projectId: number,
  moduleId: number,
  body: RunSequencesBatchRequest
): Promise<RunSequencesBatchResponse> {
  const response = await fetchWithAuth(
    `/api/projects/${projectId}/modules/${moduleId}/sequences/runs`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  }

  return response.json();
}
