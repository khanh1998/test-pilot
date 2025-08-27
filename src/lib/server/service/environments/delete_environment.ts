/**
 * Environment deletion service
 */

import { deleteEnvironmentRecord } from '$lib/server/repository/db/environment';

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
  const deleted = await deleteEnvironmentRecord(environmentId, userId);
  
  if (!deleted) {
    throw new EnvironmentDeletionError(
      'Environment not found or access denied',
      'NOT_FOUND'
    );
  }

  return true;
}
