/**
 * API linking service for environments
 */

import { linkApiToEnvironment, unlinkApiFromEnvironment, isApiLinkedToEnvironment } from '$lib/server/repository/db/environment_api';

export class ApiLinkingError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ApiLinkingError';
  }
}

/**
 * Link an API to an environment
 */
export async function linkApiToEnvironmentService(
  environmentId: number,
  apiId: number
): Promise<void> {
  // Check if already linked
  const alreadyLinked = await isApiLinkedToEnvironment(environmentId, apiId);
  if (alreadyLinked) {
    throw new ApiLinkingError(
      `API ${apiId} is already linked to environment ${environmentId}`,
      'ALREADY_LINKED'
    );
  }

  await linkApiToEnvironment(environmentId, apiId);
}

/**
 * Unlink an API from an environment
 */
export async function unlinkApiFromEnvironmentService(
  environmentId: number,
  apiId: number
): Promise<void> {
  const wasLinked = await unlinkApiFromEnvironment(environmentId, apiId);
  if (!wasLinked) {
    throw new ApiLinkingError(
      `API ${apiId} is not linked to environment ${environmentId}`,
      'NOT_LINKED'
    );
  }
}
