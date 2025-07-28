import * as apiRepo from '$lib/server/repository/db/api';

interface GetBasicApiInfoParams {
  apiId: number;
  userId: number;
}

export async function getBasicApiInfo(params: GetBasicApiInfoParams) {
  const { apiId, userId } = params;

  // Always verify ownership by requiring userId
  const api = await apiRepo.getApiById(apiId, userId);

  if (!api) {
    throw new Error('API not found or access denied');
  }

  return {
    id: api.id,
    name: api.name,
    description: api.description,
    host: api.host,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt
  };
}

/**
 * Get multiple APIs by IDs with ownership verification
 */
export async function getApisByIds(apiIds: number[], userId: number) {
  const apis = [];
  
  for (const apiId of apiIds) {
    const api = await apiRepo.getApiById(apiId, userId);
    if (api) {
      apis.push(api);
    }
  }
  
  return apis;
}

/**
 * Get API statistics for a user
 */
export async function getUserApiStats(userId: number) {
  const apisWithCounts = await apiRepo.getApisWithEndpointCounts(userId);
  const totalApis = apisWithCounts.length;
  
  if (totalApis === 0) {
    return {
      totalApis: 0,
      totalEndpoints: 0,
      averageEndpointsPerApi: 0
    };
  }
  
  const totalEndpoints = apisWithCounts.reduce((sum, api) => sum + api.endpointCount, 0);
  
  return {
    totalApis,
    totalEndpoints,
    averageEndpointsPerApi: Math.round(totalEndpoints / totalApis)
  };
}
