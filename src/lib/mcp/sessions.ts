import { randomUUID } from 'node:crypto';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export type FlowSessionStatus =
  | 'awaiting_scope_selection'
  | 'ready_for_draft'
  | 'draft_created'
  | 'saved';

export interface FlowSessionRecord {
  id: string;
  userId: number;
  projectId: number;
  sourceFlowId?: number;
  apiIds: number[];
  environmentId?: number;
  subEnvironment?: string;
  draftId?: string;
  status: FlowSessionStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

const sessions = new Map<string, FlowSessionRecord>();

function resolveTtlMs(): number {
  const raw = process.env.TEST_PILOT_MCP_SESSION_TTL_MS;
  const parsed = raw ? Number(raw) : DEFAULT_TTL_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

function purgeExpiredSessions(now = Date.now()): void {
  for (const [id, record] of sessions.entries()) {
    if (record.expiresAt <= now) {
      sessions.delete(id);
    }
  }
}

export function getFlowSessionTtlMs(): number {
  return resolveTtlMs();
}

export function createFlowSession(
  userId: number,
  projectId: number,
  options?: { sourceFlowId?: number }
): FlowSessionRecord {
  purgeExpiredSessions();
  const now = Date.now();
  const ttlMs = resolveTtlMs();
  const record: FlowSessionRecord = {
    id: randomUUID(),
    userId,
    projectId,
    sourceFlowId: options?.sourceFlowId,
    apiIds: [],
    status: 'awaiting_scope_selection',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs
  };
  sessions.set(record.id, record);
  return record;
}

export function getFlowSession(sessionId: string, userId: number): FlowSessionRecord | null {
  purgeExpiredSessions();
  const record = sessions.get(sessionId);
  if (!record || record.userId !== userId) {
    return null;
  }
  return record;
}

export function updateFlowSession(
  sessionId: string,
  userId: number,
  patch: Partial<Omit<FlowSessionRecord, 'id' | 'userId' | 'createdAt'>>
): FlowSessionRecord {
  purgeExpiredSessions();
  const existing = getFlowSession(sessionId, userId);
  if (!existing) {
    throw new Error(`Flow session ${sessionId} was not found for this user. It may have expired from memory.`);
  }

  const ttlMs = resolveTtlMs();
  const updated: FlowSessionRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  sessions.set(sessionId, updated);
  return updated;
}
