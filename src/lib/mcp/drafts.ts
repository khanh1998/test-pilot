import { randomUUID } from 'node:crypto';
import type { FlowDocument } from './flow';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

interface DraftRecord {
  id: string;
  userId: number;
  document: FlowDocument;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

const drafts = new Map<string, DraftRecord>();

function resolveTtlMs(): number {
  const raw = process.env.TEST_PILOT_MCP_DRAFT_TTL_MS;
  const parsed = raw ? Number(raw) : DEFAULT_TTL_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

function purgeExpiredDrafts(now = Date.now()): void {
  for (const [id, record] of drafts.entries()) {
    if (record.expiresAt <= now) {
      drafts.delete(id);
    }
  }
}

export function getDraftTtlMs(): number {
  return resolveTtlMs();
}

export function createDraft(userId: number, document: FlowDocument): DraftRecord {
  purgeExpiredDrafts();
  const id = randomUUID();
  const now = Date.now();
  const ttlMs = resolveTtlMs();
  const record: DraftRecord = {
    id,
    userId,
    document,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs
  };
  drafts.set(id, record);
  return record;
}

export function getDraft(draftId: string, userId: number): DraftRecord | null {
  purgeExpiredDrafts();
  const record = drafts.get(draftId);
  if (!record || record.userId !== userId) {
    return null;
  }
  return record;
}

export function updateDraft(draftId: string, userId: number, document: FlowDocument): DraftRecord {
  purgeExpiredDrafts();
  const existing = getDraft(draftId, userId);
  if (!existing) {
    throw new Error(`Draft ${draftId} was not found for this user. It may have expired from memory.`);
  }

  const ttlMs = resolveTtlMs();
  const updated: DraftRecord = {
    ...existing,
    document,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  drafts.set(draftId, updated);
  return updated;
}

export function deleteDraft(draftId: string, userId: number): boolean {
  purgeExpiredDrafts();
  const existing = getDraft(draftId, userId);
  if (!existing) {
    return false;
  }
  return drafts.delete(draftId);
}
