import { deleteProject } from '$lib/server/repository/db/projects';

export interface DeleteProjectOutput {
  success: boolean;
}

/**
 * Delete a project
 * @param projectId - The project ID
 * @param userId - The user ID to verify ownership
 * @returns Success status
 */
export async function deleteProjectService(
  projectId: number,
  userId: number
): Promise<DeleteProjectOutput> {
  const success = await deleteProject(projectId, userId);
  
  return {
    success
  };
}
