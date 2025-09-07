import { deleteSequence, getSequenceById } from '$lib/server/repository/db/sequences';
import { projectExistsForUser } from '$lib/server/repository/db/projects';

export interface DeleteSequenceOutput {
  success: boolean;
}

/**
 * Delete a sequence
 * @param sequenceId - The sequence ID
 * @param userId - The user ID to verify ownership through project
 * @returns Success status
 */
export async function deleteSequenceService(
  sequenceId: number,
  userId: number
): Promise<DeleteSequenceOutput | null> {
  // First, get the existing sequence to verify ownership
  const existingSequence = await getSequenceById(sequenceId);
  if (!existingSequence) {
    return null;
  }

  // Verify user owns the project that contains this sequence
  const userOwnsProject = await projectExistsForUser(existingSequence.projectId, userId);
  if (!userOwnsProject) {
    return null;
  }

  const success = await deleteSequence(sequenceId);
  
  return {
    success
  };
}
