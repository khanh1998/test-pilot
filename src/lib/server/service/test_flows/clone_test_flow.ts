import { getTestFlowById, createTestFlowApis, createTestFlow, getTestFlowApiIds } from '$lib/server/repository/db/test-flows';

export interface CloneTestFlowInput {
  name: string;
  description?: string;
}

export interface CloneTestFlowOutput {
  testFlow: {
    id: number;
    name: string;
    description: string | null;
    flowJson: any;
    userId: number | null;
    createdAt: Date;
    updatedAt: Date;
    apis: Array<{ id: number }>;
  };
}

/**
 * Clone an existing test flow with a new name and description
 * @param originalTestFlowId - The ID of the test flow to clone
 * @param userId - The ID of the user creating the clone
 * @param input - The new name and description for the cloned test flow
 * @returns The cloned test flow with its associations
 */
export async function cloneTestFlow(
  originalTestFlowId: number,
  userId: number,
  input: CloneTestFlowInput
): Promise<CloneTestFlowOutput> {
  const { name, description } = input;

  // Get the original test flow with its APIs
  const originalFlow = await getTestFlowById(originalTestFlowId, userId);
  if (!originalFlow) {
    throw new Error('Test flow not found or does not belong to the user');
  }

  // Create the cloned test flow
  const newTestFlow = await createTestFlow({
    name,
    description: description || originalFlow.description,
    userId,
    flowJson: originalFlow.flowJson
  });

  // Get the API IDs from the original test flow
  const apiIds = await getTestFlowApiIds(originalTestFlowId);

  // Create API associations for the cloned test flow
  if (apiIds.length > 0) {
    await createTestFlowApis(newTestFlow.id, apiIds);
  }

  return {
    testFlow: {
      ...newTestFlow,
      apis: apiIds.map((id: number) => ({ id }))
    }
  };
}
