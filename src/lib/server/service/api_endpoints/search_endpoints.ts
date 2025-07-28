import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';

interface SearchEndpointsParams {
  query: string;
  userId: number;
  apiId?: number;
  limit: number,
}

export async function searchEndpointsByDescription(params: SearchEndpointsParams) {
  const { query, userId, apiId, limit } = params;

  // Validate input
  if (!query.trim()) {
    throw new Error('Search query cannot be empty');
  }

  // Search using full-text search
  const results = await apiEndpointsRepo.searchByTsVector({
    query: query.trim(),
    userId,
    apiId,
    limit,
  });

  return results.map(endpoint => ({
    id: endpoint.id,
    apiId: endpoint.apiId,
    path: endpoint.path,
    method: endpoint.method,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    description: endpoint.description,
    tags: endpoint.tags,
    createdAt: endpoint.createdAt,
    relevanceScore: endpoint.rank
  }));
}
