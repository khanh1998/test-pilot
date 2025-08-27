/**
 * Environment update service
 */

import { updateEnvironmentRecord, checkEnvironmentNameExists } from '$lib/server/repository/db/environment';
import { linkApiToEnvironment, unlinkApiFromEnvironment, getLinkedApiIds } from '$lib/server/repository/db/environment_api';
import type { UpdateEnvironmentData, Environment } from '$lib/types/environment';

export class EnvironmentUpdateError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentUpdateError';
  }
}

/**
 * Update an environment
 */
export async function updateEnvironment(
  environmentId: number,
  userId: number,
  data: UpdateEnvironmentData
): Promise<Environment | null> {
  // Check if environment name already exists for this user (excluding current environment)
  if (data.name) {
    const nameExists = await checkEnvironmentNameExists(data.name, userId, environmentId);
    if (nameExists) {
      throw new EnvironmentUpdateError(
        `Environment with name "${data.name}" already exists`,
        'DUPLICATE_NAME'
      );
    }
  }

  // Update the environment record
  const updatedEnvironment = await updateEnvironmentRecord(environmentId, userId, {
    ...data,
    updatedAt: new Date()
  });

  if (!updatedEnvironment) {
    return null;
  }

  // Update API links if config includes linked_apis
  if (data.config && data.config.linked_apis !== undefined) {
    await updateApiLinks(environmentId, data.config.linked_apis);
  }

  // Return the updated environment with current linked APIs
  const linkedApiIds = await getLinkedApiIds(environmentId);
  
  return {
    ...updatedEnvironment,
    config: {
      ...updatedEnvironment.config,
      linked_apis: linkedApiIds
    }
  };
}

/**
 * Update API links for an environment
 */
async function updateApiLinks(environmentId: number, newApiIds: number[]): Promise<void> {
  const currentApiIds = await getLinkedApiIds(environmentId);
  
  // Find APIs to add and remove
  const apisToAdd = newApiIds.filter(apiId => !currentApiIds.includes(apiId));
  const apisToRemove = currentApiIds.filter(apiId => !newApiIds.includes(apiId));

  // Add new API links
  for (const apiId of apisToAdd) {
    try {
      await linkApiToEnvironment(environmentId, apiId);
    } catch (error) {
      console.warn(`Failed to link API ${apiId} to environment ${environmentId}:`, error);
    }
  }

  // Remove old API links
  for (const apiId of apisToRemove) {
    try {
      await unlinkApiFromEnvironment(environmentId, apiId);
    } catch (error) {
      console.warn(`Failed to unlink API ${apiId} from environment ${environmentId}:`, error);
    }
  }
}
