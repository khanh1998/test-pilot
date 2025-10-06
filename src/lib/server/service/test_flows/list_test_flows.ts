import { getUserTestFlows } from '$lib/server/repository/db/test-flows';

export interface TestFlowListItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestFlowListResponse {
  testFlows: TestFlowListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Get all test flows for a user with their API associations and pagination
 * @param userId - The user ID
 * @param options - Pagination and filtering options
 * @returns Object with test flows array and pagination info
 */
export async function getTestFlowsForUser(
  userId: number,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    projectId?: number;
  } = {}
): Promise<TestFlowListResponse> {
  const { page = 1, limit = 20, search, projectId } = options;
  const offset = (page - 1) * limit;

  // Get test flows with pagination from repository
  const { testFlows: userTestFlows, total } = await getUserTestFlows(userId, {
    limit,
    offset,
    search,
    projectId
  });

  // Map test flows to the response format
  const testFlows = userTestFlows;

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit);

  return {
    testFlows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}
