import { getSequenceById } from '$lib/server/repository/db/sequences';
import { projectExistsForUser } from '$lib/server/repository/db/projects';
import type { Sequence } from '$lib/server/repository/db/sequences';

export interface GetSequenceOutput {
  sequence: Sequence;
}

/**
 * Get a sequence by ID
 * @param sequenceId - The sequence ID
 * @param userId - The user ID to verify ownership through project
 * @returns The sequence if found and owned by user
 */
export async function getSequenceService(
  sequenceId: number,
  userId: number
): Promise<GetSequenceOutput | null> {
  const sequence = await getSequenceById(sequenceId);
  
  if (!sequence) {
    return null;
  }

  // Verify user owns the project that contains this sequence
  const userOwnsProject = await projectExistsForUser(sequence.projectId, userId);
  if (!userOwnsProject) {
    return null;
  }

  return {
    sequence
  };
}
