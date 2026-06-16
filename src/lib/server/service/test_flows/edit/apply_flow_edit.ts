import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getTestFlowById } from '$lib/server/repository/db/test-flows';
import type { TestFlowData } from '$lib/components/test-flows/types';

export type TestFlowRow = {
  id: number;
  name: string;
  description: string | null;
  flowJson: unknown;
  userId: number | null;
  projectId: number | null;
  environmentId: number | null;
  draftOf: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function applyFlowEdit(
  flowId: number,
  userId: number,
  editFn: (flowData: TestFlowData) => TestFlowData
): Promise<TestFlowRow> {
  const flow = await getTestFlowById(flowId, userId);
  if (!flow) throw new Error('Test flow not found or does not belong to the user');

  const updatedData = editFn(flow.flowJson as TestFlowData);

  const [updated] = await db
    .update(testFlows)
    .set({ flowJson: updatedData, updatedAt: new Date() })
    .where(eq(testFlows.id, flowId))
    .returning();

  return updated as TestFlowRow;
}
