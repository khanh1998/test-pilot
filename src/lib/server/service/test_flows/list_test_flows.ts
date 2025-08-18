import { getUserTestFlows, getMultipleTestFlowApiAssociations } from '$lib/server/repository/db/test-flows';

export interface TestFlowListItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  apis: Array<{
    id: number;
    name: string;
  }>;
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
  } = {}
): Promise<TestFlowListResponse> {
  const { page = 1, limit = 20, search } = options;
  const offset = (page - 1) * limit;

  // Get test flows with pagination from repository
  const { testFlows: userTestFlows, total } = await getUserTestFlows(userId, {
    limit,
    offset,
    search
  });

  // Get associated APIs for each test flow
  const testFlowIds = userTestFlows.map((flow) => flow.id);

  let testFlowApisMap: Record<number, { id: number; name: string }[]> = {};

  if (testFlowIds.length > 0) {
    const testFlowApiAssociations = await getMultipleTestFlowApiAssociations(testFlowIds);

    // Group APIs by test flow
    testFlowApisMap = testFlowApiAssociations.reduce(
      (acc, item) => {
        if (!acc[item.testFlowId]) {
          acc[item.testFlowId] = [];
        }
        acc[item.testFlowId].push({
          id: item.apiId,
          name: item.apiName
        });
        return acc;
      },
      {} as Record<number, { id: number; name: string }[]>
    );
  }

  // Add APIs to each test flow
  const testFlows = userTestFlows.map((flow) => ({
    ...flow,
    apis: testFlowApisMap[flow.id] || []
  }));

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
