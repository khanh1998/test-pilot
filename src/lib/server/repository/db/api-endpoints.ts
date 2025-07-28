import { db } from '$lib/server/db';
import { apiEndpoints, apis, endpointEmbeddings } from '$lib/server/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export async function getApiEndpointById(endpointId: number, userId?: number) {
  const query = db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      requestSchema: apiEndpoints.requestSchema,
      responseSchema: apiEndpoints.responseSchema,
      parameters: apiEndpoints.parameters,
      tags: apiEndpoints.tags,
      createdAt: apiEndpoints.createdAt
    })
    .from(apiEndpoints)
    .leftJoin(apis, eq(apiEndpoints.apiId, apis.id))
    .where(
      userId 
        ? and(eq(apiEndpoints.id, endpointId), eq(apis.userId, userId))
        : eq(apiEndpoints.id, endpointId)
    );

  const results = await query;
  return results.length > 0 ? results[0] : null;
}

export async function getApiEndpointsByApiId(apiId: number) {
  return await db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      requestSchema: apiEndpoints.requestSchema,
      responseSchema: apiEndpoints.responseSchema,
      parameters: apiEndpoints.parameters,
      tags: apiEndpoints.tags,
      createdAt: apiEndpoints.createdAt
    })
    .from(apiEndpoints)
    .where(eq(apiEndpoints.apiId, apiId))
    .orderBy(apiEndpoints.path, apiEndpoints.method);
}

export async function getApiEndpointsByIds(endpointIds: number[], userId?: number) {
  const query = db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      requestSchema: apiEndpoints.requestSchema,
      responseSchema: apiEndpoints.responseSchema,
      parameters: apiEndpoints.parameters,
      tags: apiEndpoints.tags,
      createdAt: apiEndpoints.createdAt
    })
    .from(apiEndpoints)
    .leftJoin(apis, eq(apiEndpoints.apiId, apis.id))
    .where(
      userId 
        ? and(inArray(apiEndpoints.id, endpointIds), eq(apis.userId, userId))
        : inArray(apiEndpoints.id, endpointIds)
    );

  return await query;
}

// search endpoints by using `search_vector` in `endpoint_embeddings`
interface SearchByTsVectorParams  {
  query: string,
  userId: number,
  apiId?: number, // optional
  limit: number,
}

export async function searchByTsVector(params: SearchByTsVectorParams) {
  const { query, userId, apiId } = params;
  
  let whereConditions = and(
    eq(endpointEmbeddings.userId, userId),
    sql`${endpointEmbeddings.searchVector} @@ plainto_tsquery('english',${query})`
  );

  if (apiId) {
    whereConditions = and(
      whereConditions,
      eq(endpointEmbeddings.apiId, apiId)
    );
  }

  const results = await db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      tags: apiEndpoints.tags,
      createdAt: apiEndpoints.createdAt,
      rank: sql<number>`ts_rank(${endpointEmbeddings.searchVector}, plainto_tsquery(${query}))`
    })
    .from(apiEndpoints)
    .innerJoin(endpointEmbeddings, eq(apiEndpoints.id, endpointEmbeddings.endpointId))
    .where(whereConditions)
    .orderBy(sql`ts_rank(${endpointEmbeddings.searchVector}, plainto_tsquery(${query})) DESC`)
    .limit(params.limit);

  return results;
}