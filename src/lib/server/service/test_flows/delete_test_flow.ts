import { db } from '$lib/server/db';
import { testFlows } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { testFlowExistsForUser, deleteTestFlowApis } from '$lib/server/repository/db/test-flows';

/**
 * Delete a test flow and all its associations
 * @param testFlowId - The ID of the test flow to delete
 * @param userId - The ID of the user making the request
 * @returns True if deleted successfully, false if not found
 */
export async function deleteTestFlow(testFlowId: number, userId: number): Promise<boolean> {
  // Check if the test flow exists and belongs to the user
  const exists = await testFlowExistsForUser(testFlowId, userId);
  if (!exists) {
    return false;
  }

  // Delete test flow API associations first (due to foreign key constraints)
  await deleteTestFlowApis(testFlowId);

  // Delete the test flow
  await db.delete(testFlows).where(eq(testFlows.id, testFlowId));

  return true;
}
