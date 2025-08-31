/**
 * Environment repository - Database operations for environments
 */

import { db } from '$lib/server/db';
import { environments, environmentApis } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import type { Environment, CreateEnvironmentData, UpdateEnvironmentData } from '$lib/types/environment';

export interface EnvironmentInsert {
  name: string;
  description?: string;
  userId: number;
  config: any; // JSONB
}

export interface EnvironmentUpdate {
  name?: string;
  description?: string;
  config?: any; // JSONB
  updatedAt: Date;
}

/**
 * Convert database record to Environment type
 */
function mapDbRecordToEnvironment(record: any): Environment {
  return {
    ...record,
    description: record.description || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/**
 * Create a new environment
 */
export async function createEnvironmentRecord(
  data: EnvironmentInsert
): Promise<Environment> {
  const [result] = await db
    .insert(environments)
    .values(data)
    .returning();
  
  return mapDbRecordToEnvironment(result);
}

/**
 * Get all environments for a user
 */
export async function getEnvironmentsByUserId(userId: number): Promise<Environment[]> {
  const results = await db
    .select()
    .from(environments)
    .where(eq(environments.userId, userId))
    .orderBy(environments.name);

  return results.map(mapDbRecordToEnvironment);
}

/**
 * Get a specific environment by ID and user ID
 */
export async function getEnvironmentByIdAndUserId(
  id: number, 
  userId: number
): Promise<Environment | null> {
  const [result] = await db
    .select()
    .from(environments)
    .where(and(
      eq(environments.id, id),
      eq(environments.userId, userId)
    ));

  if (!result) return null;

  return mapDbRecordToEnvironment(result);
}

/**
 * Update an environment
 */
export async function updateEnvironmentRecord(
  id: number,
  userId: number,
  data: EnvironmentUpdate
): Promise<Environment | null> {
  const [result] = await db
    .update(environments)
    .set(data)
    .where(and(
      eq(environments.id, id),
      eq(environments.userId, userId)
    ))
    .returning();

  if (!result) return null;

  return mapDbRecordToEnvironment(result);
}

/**
 * Delete an environment
 */
export async function deleteEnvironmentRecord(
  id: number,
  userId: number
): Promise<boolean> {
  const result = await db
    .delete(environments)
    .where(and(
      eq(environments.id, id),
      eq(environments.userId, userId)
    ))
    .returning({ id: environments.id });

  return result.length > 0;
}

/**
 * Check if an environment name already exists for a user
 */
export async function checkEnvironmentNameExists(
  name: string,
  userId: number,
  excludeId?: number
): Promise<boolean> {
  let conditions = [
    eq(environments.name, name),
    eq(environments.userId, userId)
  ];

  if (excludeId) {
    conditions.push(ne(environments.id, excludeId));
  }

  const [result] = await db
    .select({ id: environments.id })
    .from(environments)
    .where(and(...conditions));

  return !!result;
}
