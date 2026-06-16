import { addFlowParameter } from '$lib/flow-editor/parameters';
import { setFlowOutput } from '$lib/flow-editor/outputs';
import { linkEnvironmentToFlowData } from '$lib/flow-editor/environment';
import type { LinkEnvironmentInput } from '$lib/flow-editor/environment';
import type { TestFlowData, FlowParameter, FlowOutput } from '$lib/components/test-flows/types';
import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getTestFlowById } from '$lib/server/repository/db/test-flows';
import { applyFlowEdit } from './apply_flow_edit';
import type { TestFlowRow } from './apply_flow_edit';

export type { LinkEnvironmentInput };

export async function addFlowParameterToTestFlow(
  flowId: number,
  userId: number,
  parameter: FlowParameter
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) => addFlowParameter(data, parameter));
}

export async function setFlowOutputInTestFlow(
  flowId: number,
  userId: number,
  output: FlowOutput
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) => setFlowOutput(data, output));
}

export async function linkEnvironmentToTestFlow(
  flowId: number,
  userId: number,
  input: LinkEnvironmentInput
): Promise<TestFlowRow> {
  const flow = await getTestFlowById(flowId, userId);
  if (!flow) throw new Error('Test flow not found or does not belong to the user');

  const updatedData = linkEnvironmentToFlowData(flow.flowJson as TestFlowData, input);

  const [updated] = await db
    .update(testFlows)
    .set({ flowJson: updatedData, environmentId: input.environmentId, updatedAt: new Date() })
    .where(eq(testFlows.id, flowId))
    .returning();

  return updated as TestFlowRow;
}
