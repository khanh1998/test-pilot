import { randomUUID } from 'node:crypto';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export interface FlowRunRecord {
  id: string;
  userId: number;
  flowId?: number;
  sessionId?: string;
  draftId?: string;
  status: 'running' | 'completed' | 'failed';
  summary: string;
  success: boolean;
  error?: string;
  startedAt: number;
  completedAt?: number;
  expiresAt: number;
  executionState: Record<string, unknown>;
  logs: Array<{ level: 'info' | 'debug' | 'error' | 'warning'; message: string; details?: string }>;
  storedResponses: Record<string, unknown>;
  parameterValues: Record<string, unknown>;
  flowOutputs: Record<string, unknown>;
}

const runs = new Map<string, FlowRunRecord>();

function resolveTtlMs(): number {
  const raw = process.env.TEST_PILOT_MCP_RUN_TTL_MS;
  const parsed = raw ? Number(raw) : DEFAULT_TTL_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

function purgeExpiredRuns(now = Date.now()): void {
  for (const [id, record] of runs.entries()) {
    if (record.expiresAt <= now) {
      runs.delete(id);
    }
  }
}

export function getFlowRunTtlMs(): number {
  return resolveTtlMs();
}

export function createFlowRun(
  userId: number,
  input: {
    flowId?: number;
    sessionId?: string;
    draftId?: string;
  }
): FlowRunRecord {
  purgeExpiredRuns();
  const ttlMs = resolveTtlMs();
  const record: FlowRunRecord = {
    id: randomUUID(),
    userId,
    flowId: input.flowId,
    sessionId: input.sessionId,
    draftId: input.draftId,
    status: 'running',
    summary: 'Flow execution started.',
    success: false,
    startedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    executionState: {},
    logs: [],
    storedResponses: {},
    parameterValues: {},
    flowOutputs: {}
  };
  runs.set(record.id, record);
  return record;
}

export function getFlowRun(runId: string, userId: number): FlowRunRecord | null {
  purgeExpiredRuns();
  const record = runs.get(runId);
  if (!record || record.userId !== userId) {
    return null;
  }
  return record;
}

export function updateFlowRun(
  runId: string,
  userId: number,
  patch: Partial<Omit<FlowRunRecord, 'id' | 'userId' | 'startedAt'>>
): FlowRunRecord {
  purgeExpiredRuns();
  const existing = getFlowRun(runId, userId);
  if (!existing) {
    throw new Error(`Flow run ${runId} was not found for this user. It may have expired from memory.`);
  }

  const ttlMs = resolveTtlMs();
  const updated: FlowRunRecord = {
    ...existing,
    ...patch,
    expiresAt: Date.now() + ttlMs
  };
  runs.set(runId, updated);
  return updated;
}
