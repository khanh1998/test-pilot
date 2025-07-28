import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';

interface GetEndpointDetailsParams {
  endpointId: number;
  userId?: number;
}

export async function getEndpointDetails(params: GetEndpointDetailsParams) {
  const { endpointId, userId } = params;

  const endpoint = await apiEndpointsRepo.getApiEndpointById(endpointId, userId);

  if (!endpoint) {
    throw new Error('Endpoint not found or access denied');
  }

  return endpoint;
}

interface GetMultipleEndpointsParams {
  endpointIds: number[];
  userId?: number;
}

export async function getMultipleEndpoints(params: GetMultipleEndpointsParams) {
  const { endpointIds, userId } = params;

  if (endpointIds.length === 0) {
    return [];
  }

  return await apiEndpointsRepo.getApiEndpointsByIds(endpointIds, userId);
}
