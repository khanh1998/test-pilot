import { randomUUID } from 'node:crypto';
import type { FlowDocument } from './flow';

interface DraftRecord {
  id: string;
  userId: number;
  document: FlowDocument;
  createdAt: number;
  updatedAt: number;
}

const drafts = new Map<string, DraftRecord>();

export function createDraft(userId: number, document: FlowDocument): DraftRecord {
  const id = randomUUID();
  const now = Date.now();
  const record: DraftRecord = {
    id,
    userId,
    document,
    createdAt: now,
    updatedAt: now
  };
  drafts.set(id, record);
  return record;
}

export function getDraft(draftId: string, userId: number): DraftRecord | null {
  const record = drafts.get(draftId);
  if (!record || record.userId !== userId) {
    return null;
  }
  return record;
}

export function updateDraft(draftId: string, userId: number, document: FlowDocument): DraftRecord {
  const existing = getDraft(draftId, userId);
  if (!existing) {
    throw new Error(`Draft ${draftId} was not found for this user.`);
  }

  const updated: DraftRecord = {
    ...existing,
    document,
    updatedAt: Date.now()
  };
  drafts.set(draftId, updated);
  return updated;
}

export function deleteDraft(draftId: string, userId: number): boolean {
  const existing = getDraft(draftId, userId);
  if (!existing) {
    return false;
  }
  return drafts.delete(draftId);
}
