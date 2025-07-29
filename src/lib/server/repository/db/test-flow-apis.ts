import { db } from '$lib/server/db';
import { testFlowApis } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Update API associations for a test flow
 * @param testFlowId - The test flow ID
 * @param apiIds - Array of API IDs to associate with the test flow
 */
export async function updateTestFlowApis(testFlowId: number, apiIds: number[]): Promise<void> {
  // Delete existing associations
  await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, testFlowId));

  // Insert new associations
  if (apiIds.length > 0) {
    await db.insert(testFlowApis).values(
      apiIds.map((apiId) => ({
        testFlowId,
        apiId
      }))
    );
  }
}

/**
 * Delete all API associations for a test flow
 * @param testFlowId - The test flow ID
 */
export async function deleteTestFlowApis(testFlowId: number): Promise<void> {
  await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, testFlowId));
}

/**
 * Create API associations for a test flow
 * @param testFlowId - The test flow ID
 * @param apiIds - Array of API IDs to associate with the test flow
 */
export async function createTestFlowApis(testFlowId: number, apiIds: number[]): Promise<void> {
  if (apiIds.length > 0) {
    await db.insert(testFlowApis).values(
      apiIds.map((apiId) => ({
        testFlowId,
        apiId
      }))
    );
  }
}
