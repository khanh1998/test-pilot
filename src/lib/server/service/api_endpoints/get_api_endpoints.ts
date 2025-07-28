import * as apiRepo from '$lib/server/repository/db/api';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';

interface GetApiEndpointsParams {
  apiId: number;
  userId: number;
}

interface ApiEndpointsResponse {
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  endpoints: Array<{
    id: number;
    apiId: number;
    path: string;
    method: string;
    operationId: string | null;
    summary: string | null;
    description: string | null;
    requestSchema: any;
    responseSchema: any;
    parameters: any;
    tags: string[] | null;
    createdAt: Date;
  }>;
}

export async function getApiEndpoints(params: GetApiEndpointsParams): Promise<ApiEndpointsResponse> {
  const { apiId, userId } = params;

  // Get the API and check if it belongs to the user
  const api = await apiRepo.getApiById(apiId, userId);

  if (!api) {
    throw new Error('API not found or access denied');
  }

  // Get all endpoints for the API
  const endpoints = await apiEndpointsRepo.getApiEndpointsByApiId(apiId);

  return {
    api: {
      id: api.id,
      name: api.name,
      description: api.description,
      host: api.host,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt
    },
    endpoints
  };
}
