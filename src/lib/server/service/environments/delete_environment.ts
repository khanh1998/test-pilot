/**
 * Environment deletion service
 */

import { deleteEnvironmentRecord, getEnvironmentByIdAndUserId } from '$lib/server/repository/db/environment';

export class EnvironmentDeletionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentDeletionError';
  }
}

/**
 * Delete an environment
 */
export async function deleteEnvironment(
  environmentId: number,
  userId: number
): Promise<boolean> {
  // First check if the environment exists and belongs to the user
  const existingEnvironment = await getEnvironmentByIdAndUserId(environmentId, userId);
  
  if (!existingEnvironment) {
    throw new EnvironmentDeletionError(
      'Environment not found or access denied',
      'NOT_FOUND'
    );
  }

  // Attempt to delete the environment
  const deleted = await deleteEnvironmentRecord(environmentId, userId);
  
  if (!deleted) {
    throw new EnvironmentDeletionError(
      'Failed to delete environment',
      'DELETE_FAILED'
    );
  }

  return true;
}
