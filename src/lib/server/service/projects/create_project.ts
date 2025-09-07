import { createProject, validateUserApis } from '$lib/server/repository/db/projects';
import type { ProjectConfig } from '$lib/server/repository/db/projects';

export interface CreateProjectInput {
  name: string;
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

export interface CreateProjectOutput {
  project: {
    id: number;
    name: string;
    description: string | null;
    userId: number;
    config: ProjectConfig;
    createdAt: Date;
    updatedAt: Date;
  };
}

/**
 * Create a new project
 * @param userId - The ID of the user creating the project
 * @param input - The project data
 * @returns The created project
 */
export async function createProjectService(
  userId: number,
  input: CreateProjectInput
): Promise<CreateProjectOutput> {
  const { name, description, variables = {}, api_dependencies = [], environment_id } = input;

  // Validate API dependencies belong to user
  if (api_dependencies.length > 0) {
    const validApiIds = await validateUserApis(api_dependencies, userId);
    if (validApiIds.length !== api_dependencies.length) {
      throw new Error('One or more APIs not found or do not belong to the user');
    }
  }

  // Create project config
  const config: ProjectConfig = {
    variables,
    api_dependencies,
    environment_id: environment_id || null
  };

  // Create the project
  const project = await createProject({
    name,
    description,
    userId,
    config
  });

  return {
    project
  };
}
