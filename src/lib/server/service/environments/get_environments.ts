/**
 * Environment retrieval service
 */

import { getEnvironmentsByUserId, getEnvironmentByIdAndUserId } from '$lib/server/repository/db/environment';
import { getLinkedApiIds } from '$lib/server/repository/db/environment_api';
import type { Environment } from '$lib/types/environment';

/**
 * Get all environments for a user
 */
export async function getEnvironmentsForUser(userId: number): Promise<Environment[]> {
  return await getEnvironmentsByUserId(userId);
}

/**
 * Get a specific environment by ID for a user
 */
export async function getEnvironmentForUser(
  environmentId: number,
  userId: number
): Promise<Environment | null> {
  const environment = await getEnvironmentByIdAndUserId(environmentId, userId);
  
  if (!environment) {
    return null;
  }

  // Enrich with linked APIs
  const linkedApiIds = await getLinkedApiIds(environmentId);
  
  return {
    ...environment,
    config: {
      ...environment.config,
      linked_apis: linkedApiIds
    }
  };
}
