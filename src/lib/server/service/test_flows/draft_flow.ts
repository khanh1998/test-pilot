import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  getTestFlowById,
  getTestFlowApiIds,
  createTestFlowApis,
  updateTestFlowApis,
  deleteTestFlowApis
} from '$lib/server/repository/db/test-flows';

export interface CreateDraftResult {
  draftFlowId: number;
  originalFlowId: number;
}

export async function createTestFlowDraft(
  originalFlowId: number,
  userId: number
): Promise<CreateDraftResult> {
  const original = await getTestFlowById(originalFlowId, userId);
  if (!original) throw new Error('Test flow not found or does not belong to the user');

  const [draft] = await db
    .insert(testFlows)
    .values({
      name: original.name,
      description: original.description,
      userId,
      projectId: original.projectId,
      environmentId: original.environmentId,
      flowJson: original.flowJson,
      draftOf: originalFlowId
    })
    .returning({ id: testFlows.id });

  const apiIds = await getTestFlowApiIds(originalFlowId);
  if (apiIds.length > 0) {
    await createTestFlowApis(draft.id, apiIds);
  }

  return { draftFlowId: draft.id, originalFlowId };
}

export async function commitTestFlowDraft(
  draftFlowId: number,
  userId: number
): Promise<{ id: number; name: string; flowJson: unknown }> {
  const [draft] = await db
    .select()
    .from(testFlows)
    .where(and(eq(testFlows.id, draftFlowId), eq(testFlows.userId, userId)));

  if (!draft) throw new Error('Draft flow not found or does not belong to the user');
  if (!draft.draftOf) throw new Error(`Flow ${draftFlowId} is not a draft`);

  const originalFlowId = draft.draftOf;
  const original = await getTestFlowById(originalFlowId, userId);
  if (!original) throw new Error('Original flow not found');

  const [updated] = await db
    .update(testFlows)
    .set({
      flowJson: draft.flowJson,
      environmentId: draft.environmentId,
      updatedAt: new Date()
    })
    .where(eq(testFlows.id, originalFlowId))
    .returning({ id: testFlows.id, name: testFlows.name, flowJson: testFlows.flowJson });

  const draftApiIds = await getTestFlowApiIds(draftFlowId);
  await updateTestFlowApis(originalFlowId, draftApiIds);

  await deleteTestFlowApis(draftFlowId);
  await db.delete(testFlows).where(eq(testFlows.id, draftFlowId));

  return updated;
}

export async function discardTestFlowDraft(
  draftFlowId: number,
  userId: number
): Promise<void> {
  const [draft] = await db
    .select({ id: testFlows.id, draftOf: testFlows.draftOf })
    .from(testFlows)
    .where(and(eq(testFlows.id, draftFlowId), eq(testFlows.userId, userId)));

  if (!draft) throw new Error('Draft flow not found or does not belong to the user');
  if (!draft.draftOf) throw new Error(`Flow ${draftFlowId} is not a draft`);

  await deleteTestFlowApis(draftFlowId);
  await db.delete(testFlows).where(eq(testFlows.id, draftFlowId));
}
