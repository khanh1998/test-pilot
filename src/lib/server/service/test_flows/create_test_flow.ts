import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { validateUserApis, createTestFlowApis } from '$lib/server/repository/db/test-flows';

export interface CreateTestFlowInput {
  name: string;
  description?: string;
  apiIds: number[];
  flowJson?: any;
}

export interface CreateTestFlowOutput {
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
 * Create a new test flow with API associations
 * @param userId - The ID of the user creating the test flow
 * @param input - The test flow data
 * @returns The created test flow with its associations
 */
export async function createBasicTestFlow(
  userId: number,
  input: CreateTestFlowInput
): Promise<CreateTestFlowOutput> {
  const { name, description, apiIds, flowJson } = input;

  // Verify all APIs exist and belong to the user
  const validApiIds = await validateUserApis(apiIds, userId);
  if (validApiIds.length !== apiIds.length) {
    throw new Error('One or more APIs not found or do not belong to the user');
  }

  // Create default flow JSON structure if not provided
  const defaultFlowJson = {
    settings: { api_hosts: {} },
    steps: [],
  };

  // Insert the test flow
  const [newTestFlow] = await db
    .insert(testFlows)
    .values({
      name,
      description,
      userId,
      flowJson: flowJson || defaultFlowJson
    })
    .returning();

  // Create API associations
  await createTestFlowApis(newTestFlow.id, apiIds);

  return {
    testFlow: {
      ...newTestFlow,
      apis: apiIds.map((id) => ({ id }))
    }
  };
}
