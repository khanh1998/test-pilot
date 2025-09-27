import * as apiRepo from '$lib/server/repository/db/apis';

interface ListApisParams {
  userId: number;
  projectId?: number;
}

interface ListApisResponse {
  apis: Array<{
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    createdAt: Date;
    updatedAt: Date;
    endpointCount: number;
  }>;
}

export async function listUserApis(params: ListApisParams): Promise<ListApisResponse> {
  const { userId, projectId } = params;

  const apisWithCounts = await apiRepo.getApisWithEndpointCounts(userId, projectId);

  return {
    apis: apisWithCounts.map((api) => ({
      id: api.id,
      name: api.name,
      description: api.description,
      host: api.host,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt,
      endpointCount: api.endpointCount
    }))
  };
}
