import { db } from '$lib/server/db';
import { sequences, testFlows } from '$lib/server/db/schema';
import { eq, and, desc, ilike, or, count, inArray } from 'drizzle-orm';

export interface SequenceConfig {
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description: string;
    required: boolean;
    value_source: 'project_variable' | 'hardcoded';
    project_variable: string | null;
    hardcoded_value: any;
  }>;
  flows: Array<{
    test_flow_id: number;
    order_index: number;
    parameter_mappings: Record<string, {
      source_type: 'sequence_parameter' | 'previous_flow_output';
      source_reference: string;
    }>;
  }>;
}

export interface Sequence {
  id: number;
  name: string;
  projectId: number;
  config: SequenceConfig;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceListItem {
  id: number;
  name: string;
  projectId: number;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  flowCount: number;
}

/**
 * Get sequences for a project with pagination and search
 */
export async function getProjectSequences(
  projectId: number,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<{
  sequences: Array<{
    id: number;
    name: string;
    projectId: number;
    config: SequenceConfig;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}> {
  const { limit = 20, offset = 0, search } = options;

  // Build the base query
  let whereConditions = eq(sequences.projectId, projectId);
  
  // Add search condition if provided
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    const searchCondition = ilike(sequences.name, searchTerm);
    whereConditions = and(whereConditions, searchCondition)!;
  }

  // Get the total count
  const totalResult = await db
    .select({ count: count() })
    .from(sequences)
    .where(whereConditions);
  
  const total = totalResult[0]?.count || 0;

  // Get the paginated results
  const sequencesResult = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      projectId: sequences.projectId,
      config: sequences.config,
      orderIndex: sequences.orderIndex,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt
    })
    .from(sequences)
    .where(whereConditions)
    .orderBy(sequences.orderIndex, desc(sequences.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    sequences: sequencesResult.map(sequence => ({
      ...sequence,
      config: {
        parameters: (sequence.config as any)?.parameters || {},
        flows: (sequence.config as any)?.flows || []
      } as SequenceConfig
    })),
    total
  };
}

/**
 * Get a sequence by ID
 */
export async function getSequenceById(id: number): Promise<Sequence | null> {
  const [sequence] = await db
    .select()
    .from(sequences)
    .where(eq(sequences.id, id));

  return sequence ? {
    ...sequence,
    config: {
      parameters: (sequence.config as any)?.parameters || {},
      flows: (sequence.config as any)?.flows || []
    } as SequenceConfig
  } : null;
}

/**
 * Check if a sequence exists in a project
 */
export async function sequenceExistsInProject(sequenceId: number, projectId: number): Promise<boolean> {
  const [result] = await db
    .select({ id: sequences.id })
    .from(sequences)
    .where(and(eq(sequences.id, sequenceId), eq(sequences.projectId, projectId)))
    .limit(1);
  
  return !!result;
}

/**
 * Create a new sequence
 */
export async function createSequence(sequenceData: {
  name: string;
  projectId: number;
  config: SequenceConfig;
  orderIndex?: number;
}): Promise<Sequence> {
  // If no order index provided, get the next available one
  let orderIndex = sequenceData.orderIndex;
  if (orderIndex === undefined) {
    const [maxOrder] = await db
      .select({ maxOrder: sequences.orderIndex })
      .from(sequences)
      .where(eq(sequences.projectId, sequenceData.projectId))
      .orderBy(desc(sequences.orderIndex))
      .limit(1);
    
    orderIndex = (maxOrder?.maxOrder || 0) + 1;
  }

  const [newSequence] = await db
    .insert(sequences)
    .values({
      ...sequenceData,
      orderIndex
    })
    .returning();
  
  return {
    ...newSequence,
    config: newSequence.config as SequenceConfig
  };
}

/**
 * Update a sequence
 */
export async function updateSequence(
  sequenceId: number,
  updateData: {
    name?: string;
    config?: SequenceConfig;
    orderIndex?: number;
  }
): Promise<Sequence | null> {
  const [updatedSequence] = await db
    .update(sequences)
    .set({
      ...updateData,
      updatedAt: new Date()
    })
    .where(eq(sequences.id, sequenceId))
    .returning();
  
  return updatedSequence ? {
    ...updatedSequence,
    config: {
      parameters: (updatedSequence.config as any)?.parameters || {},
      flows: (updatedSequence.config as any)?.flows || []
    } as SequenceConfig
  } : null;
}

/**
 * Delete a sequence
 */
export async function deleteSequence(sequenceId: number): Promise<boolean> {
  const result = await db
    .delete(sequences)
    .where(eq(sequences.id, sequenceId));
  
  return result.length > 0;
}

/**
 * Check if sequence name exists in project
 */
export async function sequenceNameExistsInProject(name: string, projectId: number, excludeId?: number): Promise<boolean> {
  let whereConditions = and(eq(sequences.name, name), eq(sequences.projectId, projectId));
  
  if (excludeId) {
    whereConditions = and(whereConditions, eq(sequences.id, excludeId));
  }
  
  const [result] = await db
    .select({ id: sequences.id })
    .from(sequences)
    .where(whereConditions)
    .limit(1);
  
  return !!result;
}

/**
 * Validate that test flows exist and belong to a user
 */
export async function validateUserTestFlows(testFlowIds: number[], userId: number): Promise<number[]> {
  if (testFlowIds.length === 0) {
    return [];
  }

  const userTestFlows = await db
    .select({ id: testFlows.id })
    .from(testFlows)
    .where(and(eq(testFlows.userId, userId), inArray(testFlows.id, testFlowIds)));

  return userTestFlows.map(flow => flow.id);
}

/**
 * Get next available order index for a project
 */
export async function getNextOrderIndex(projectId: number): Promise<number> {
  const [maxOrder] = await db
    .select({ maxOrder: sequences.orderIndex })
    .from(sequences)
    .where(eq(sequences.projectId, projectId))
    .orderBy(desc(sequences.orderIndex))
    .limit(1);
  
  return (maxOrder?.maxOrder || 0) + 1;
}

/**
 * Reorder sequences in a project
 */
export async function reorderSequences(projectId: number, sequenceOrders: Array<{ id: number; orderIndex: number }>): Promise<void> {
  // Update each sequence's order index
  const updatePromises = sequenceOrders.map(({ id, orderIndex }) =>
    db
      .update(sequences)
      .set({ orderIndex, updatedAt: new Date() })
      .where(and(eq(sequences.id, id), eq(sequences.projectId, projectId)))
  );

  await Promise.all(updatePromises);
}
