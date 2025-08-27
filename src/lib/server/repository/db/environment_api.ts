/**
 * Environment API repository - Database operations for environment-API links
 */

import { db } from '$lib/server/db';
import { environmentApis } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { EnvironmentApiLink } from '$lib/types/environment';

/**
 * Link an API to an environment
 */
export async function linkApiToEnvironment(
  environmentId: number,
  apiId: number
): Promise<EnvironmentApiLink> {
  const [result] = await db
    .insert(environmentApis)
    .values({
      environmentId,
      apiId
    })
    .returning();

  return {
    environmentId: result.environmentId,
    apiId: result.apiId,
    createdAt: result.createdAt.toISOString()
  };
}

/**
 * Unlink an API from an environment
 */
export async function unlinkApiFromEnvironment(
  environmentId: number,
  apiId: number
): Promise<boolean> {
  const result = await db
    .delete(environmentApis)
    .where(and(
      eq(environmentApis.environmentId, environmentId),
      eq(environmentApis.apiId, apiId)
    ));

  return result.length > 0;
}

/**
 * Get all API IDs linked to an environment
 */
export async function getLinkedApiIds(environmentId: number): Promise<number[]> {
  const results = await db
    .select({ apiId: environmentApis.apiId })
    .from(environmentApis)
    .where(eq(environmentApis.environmentId, environmentId));

  return results.map(result => result.apiId);
}

/**
 * Check if an API is linked to an environment
 */
export async function isApiLinkedToEnvironment(
  environmentId: number,
  apiId: number
): Promise<boolean> {
  const [result] = await db
    .select({ id: environmentApis.id })
    .from(environmentApis)
    .where(and(
      eq(environmentApis.environmentId, environmentId),
      eq(environmentApis.apiId, apiId)
    ));

  return !!result;
}

/**
 * Get all environment IDs that an API is linked to
 */
export async function getEnvironmentIdsForApi(apiId: number): Promise<number[]> {
  const results = await db
    .select({ environmentId: environmentApis.environmentId })
    .from(environmentApis)
    .where(eq(environmentApis.apiId, apiId));

  return results.map(result => result.environmentId);
}
