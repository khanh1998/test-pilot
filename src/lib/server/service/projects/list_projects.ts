import { getUserProjects } from '$lib/server/repository/db/projects';

export interface ListProjectsInput {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface ListProjectsOutput {
  projects: Array<{
    id: number;
    name: string;
    description: string | null;
    config: {
      variables: Record<string, {
        type: 'string' | 'number' | 'boolean';
        description: string;
        required: boolean;
        value_source: 'environment' | 'hardcoded';
        hardcoded_value: any;
        environment_variable: string | null;
      }>;
      api_dependencies: number[];
      environment_id: number | null;
    };
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  limit: number;
  offset: number;
}

/**
 * List projects for a user with pagination and search
 * @param userId - The user ID
 * @param input - The query parameters
 * @returns Paginated list of projects
 */
export async function listProjectsService(
  userId: number,
  input: ListProjectsInput = {}
): Promise<ListProjectsOutput> {
  const { limit = 20, offset = 0, search } = input;

  const result = await getUserProjects(userId, {
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
