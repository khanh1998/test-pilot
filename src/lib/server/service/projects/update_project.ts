import { updateProject, validateUserApis } from '$lib/server/repository/db/projects';
import type { ProjectConfig, Project } from '$lib/server/repository/db/projects';

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  variables?: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description: string;
    required: boolean;
    value_source: 'environment' | 'hardcoded';
    hardcoded_value: any;
    environment_variable: string | null;
  }>;
  api_dependencies?: number[];
  environment_id?: number | null;
}

export interface UpdateProjectOutput {
  project: Project;
}

/**
 * Update a project
 * @param projectId - The project ID
 * @param userId - The user ID to verify ownership
 * @param input - The project update data
 * @returns The updated project
 */
export async function updateProjectService(
  projectId: number,
  userId: number,
  input: UpdateProjectInput
): Promise<UpdateProjectOutput | null> {
  const { name, description, variables, api_dependencies, environment_id } = input;

  // Build the update data
  const updateData: {
    name?: string;
    description?: string;
    config?: ProjectConfig;
  } = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (description !== undefined) {
    updateData.description = description;
  }

  // Handle config updates
  if (variables !== undefined || api_dependencies !== undefined || environment_id !== undefined) {
    // Validate API dependencies if provided
    if (api_dependencies && api_dependencies.length > 0) {
      const validApiIds = await validateUserApis(api_dependencies, userId);
      if (validApiIds.length !== api_dependencies.length) {
        throw new Error('One or more APIs not found or do not belong to the user');
      }
    }

    // Build new config - we need to merge with existing config
    // For now, we'll replace the entire config. In a real implementation,
    // you might want to merge with existing config
    updateData.config = {
      variables: variables || {},
      api_dependencies: api_dependencies || [],
      environment_id: environment_id || null
    };
  }

  const project = await updateProject(projectId, userId, updateData);
  
  if (!project) {
    return null;
  }

  return {
    project
  };
}
