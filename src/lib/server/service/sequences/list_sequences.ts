import { getProjectSequences } from '$lib/server/repository/db/sequences';
import { projectExistsForUser } from '$lib/server/repository/db/projects';
import type { SequenceConfig } from '$lib/server/repository/db/sequences';

export interface ListSequencesInput {
  projectId: number;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ListSequencesOutput {
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
  limit: number;
  offset: number;
}

/**
 * List sequences for a project with pagination and search
 * @param userId - The user ID to verify project ownership
 * @param input - The query parameters
 * @returns Paginated list of sequences
 */
export async function listSequencesService(
  userId: number,
  input: ListSequencesInput
): Promise<ListSequencesOutput | null> {
  const { projectId, limit = 20, offset = 0, search } = input;

  // Verify project exists and belongs to user
  const projectExists = await projectExistsForUser(projectId, userId);
  if (!projectExists) {
    return null;
  }

  const result = await getProjectSequences(projectId, {
    limit,
    offset,
    search
  });

  return {
    ...result,
    limit,
    offset
  };
}
