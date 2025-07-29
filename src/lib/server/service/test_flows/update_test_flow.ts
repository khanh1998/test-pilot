import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getTestFlowById, validateUserApis as validateUserApisRepo, getTestFlowApiAssociations, updateTestFlowApis } from '$lib/server/repository/db/test-flows';

export interface UpdateTestFlowInput {
  name: string;
  description?: string;
  apiIds?: number[];
  flowJson?: any;
}

export interface UpdateTestFlowOutput {
  testFlow: {
    id: number;
    name: string;
    description: string | null;
    flowJson: any;
    userId: number | null;
    createdAt: Date;
    updatedAt: Date;
    apis?: Array<{
      id: number;
      name: string;
    }>;
  };
}

/**
 * Update an existing test flow
 * @param testFlowId - The ID of the test flow to update
 * @param userId - The ID of the user making the request
 * @param input - The update data
 * @returns The updated test flow or null if not found
 */
export async function updateTestFlow(
  testFlowId: number,
  userId: number,
  input: UpdateTestFlowInput
): Promise<UpdateTestFlowOutput | null> {
  const { name, description, apiIds, flowJson } = input;

  // Check if the test flow exists and belongs to the user
  const existingTestFlow = await getTestFlowById(testFlowId, userId);
  if (!existingTestFlow) {
    return null;
  }

  // Update the test flow basic information
  const [updatedTestFlow] = await db
    .update(testFlows)
    .set({
      name,
      description,
      flowJson: flowJson || existingTestFlow.flowJson,
      updatedAt: new Date()
    })
    .where(eq(testFlows.id, testFlowId))
    .returning();

  // Update API associations if provided
  if (apiIds && Array.isArray(apiIds)) {
    // Verify all APIs exist and belong to the user
    const validApiIds = await validateUserApisRepo(apiIds, userId);
    if (validApiIds.length !== apiIds.length) {
      throw new Error('One or more APIs not found or do not belong to the user');
    }

    // Update the API associations
    await updateTestFlowApis(testFlowId, apiIds);

    // Get the updated API associations
    const updatedApis = await getTestFlowApiAssociations(testFlowId);

    return {
      testFlow: {
        ...updatedTestFlow,
        apis: updatedApis
      }
    };
  }

  return {
    testFlow: updatedTestFlow
  };
}
