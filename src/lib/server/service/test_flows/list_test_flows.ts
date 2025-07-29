import { db } from '$lib/server/db';
import { testFlows, testFlowApis, apis } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export interface TestFlowListItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  apis: Array<{
    id: number;
    name: string;
  }>;
}

/**
 * Get all test flows for a user with their API associations
 * @param userId - The user ID
 * @returns Array of test flows with their associated APIs
 */
export async function getTestFlowsForUser(userId: number): Promise<TestFlowListItem[]> {
  // Get all test flows for the authenticated user
  const userTestFlows = await db
    .select({
      id: testFlows.id,
      name: testFlows.name,
      description: testFlows.description,
      createdAt: testFlows.createdAt,
      updatedAt: testFlows.updatedAt
    })
    .from(testFlows)
    .where(eq(testFlows.userId, userId));

  // Get associated APIs for each test flow
  const testFlowIds = userTestFlows.map((flow) => flow.id);

  if (testFlowIds.length === 0) {
    return [];
  }

  const testFlowApiAssociations = await db
    .select({
      testFlowId: testFlowApis.testFlowId,
      apiId: testFlowApis.apiId,
      apiName: apis.name
    })
    .from(testFlowApis)
    .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
    .where(inArray(testFlowApis.testFlowId, testFlowIds));

  // Group APIs by test flow
  const testFlowApisMap = testFlowApiAssociations.reduce(
    (acc, item) => {
      if (!acc[item.testFlowId]) {
        acc[item.testFlowId] = [];
      }
      acc[item.testFlowId].push({
        id: item.apiId,
        name: item.apiName
      });
      return acc;
    },
    {} as Record<number, { id: number; name: string }[]>
  );

  // Add APIs to each test flow
  return userTestFlows.map((flow) => ({
    ...flow,
    apis: testFlowApisMap[flow.id] || []
  }));
}
