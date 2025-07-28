import { db } from '$lib/server/db';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function fetchApiEndpoints(endpointIds: number[]) {
  // Fetch endpoints and join with their API info
  const endpoints = await db
    .select({
      id: apiEndpoints.id,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      requestSchema: apiEndpoints.requestSchema,
      responseSchema: apiEndpoints.responseSchema,
      apiId: apiEndpoints.apiId,
      parameters: apiEndpoints.parameters
    })
    .from(apiEndpoints)
    .leftJoin(apis, eq(apiEndpoints.apiId, apis.id))
    .where(inArray(apiEndpoints.id, endpointIds));

  return endpoints;
}

// search endpoints by using `search_vector` in `endpoint_embeddings`
interface SearchByTsVectorParams  {
  query: string,
  userId: number,
  apiId?: number, // optional
}

export async function searchByTsVector(params: SearchByTsVectorParams) {
  // This function has been moved to the search_endpoints.ts service
  // and implemented in the repository layer
  throw new Error('Use searchEndpointsByDescription from search_endpoints.ts instead');
}