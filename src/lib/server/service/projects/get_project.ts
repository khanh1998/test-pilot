import { getProjectById } from '$lib/server/repository/db/projects';
import type { Project } from '$lib/server/repository/db/projects';

export interface GetProjectOutput {
  project: Project;
}

/**
 * Get a project by ID
 * @param projectId - The project ID
 * @param userId - The user ID to verify ownership
 * @returns The project if found and owned by user
 */
export async function getProjectService(
  projectId: number,
  userId: number
): Promise<GetProjectOutput | null> {
  const project = await getProjectById(projectId, userId);
  
  if (!project) {
    return null;
  }

  return {
    project
  };
}
