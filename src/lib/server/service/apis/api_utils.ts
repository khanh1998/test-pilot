import * as apiRepo from '$lib/server/repository/db/api';

interface ValidateApiAccessParams {
  apiId: number;
  userId: number;
}

export async function validateApiAccess(params: ValidateApiAccessParams): Promise<boolean> {
  const { apiId, userId } = params;

  // Reuse the repository function for ownership verification
  return await apiRepo.verifyApiOwnership(apiId, userId);
}

interface GetBasicApiInfoParams {
  apiId: number;
  requireOwnership?: boolean;
  userId?: number;
}

export async function getBasicApiInfo(params: GetBasicApiInfoParams) {
  const { apiId, requireOwnership = false, userId } = params;

  if (requireOwnership && !userId) {
    throw new Error('User ID is required when ownership verification is needed');
  }

  // Reuse the repository function with conditional user filtering
  const api = await apiRepo.getApiById(apiId, requireOwnership ? userId : undefined);

  if (!api) {
    throw new Error('API not found');
  }

  if (requireOwnership && api.userId !== userId) {
    throw new Error('Unauthorized to access this API');
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
