import * as apiRepo from '$lib/server/repository/db/apis';

interface GetApiDetailsParams {
  apiId: number;
  userId: number;
}

interface ApiDetailsResponse {
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    createdAt: Date;
    updatedAt: Date;
    endpointCount: number;
  };
}

export async function getApiDetails(params: GetApiDetailsParams): Promise<ApiDetailsResponse> {
  const { apiId, userId } = params;

  // Get API with endpoint count
  const apiWithCount = await apiRepo.getApiWithEndpointCount(apiId);

  if (!apiWithCount) {
    throw new Error('API not found');
  }

  // Verify ownership
  if (apiWithCount.userId !== userId) {
    throw new Error('Unauthorized to access this API');
  }

  return {
    api: {
      id: apiWithCount.id,
      name: apiWithCount.name,
      description: apiWithCount.description,
      host: apiWithCount.host,
      createdAt: apiWithCount.createdAt,
      updatedAt: apiWithCount.updatedAt,
      endpointCount: apiWithCount.endpointCount
    }
  };
}
