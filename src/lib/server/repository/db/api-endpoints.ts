import { db } from '$lib/server/db';
import { apiEndpoints, apis, endpointEmbeddings } from '$lib/server/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { EndpointEmbeddingsService } from '$lib/server/service/endpoint_embeddings/create_embedding';

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

export async function getApiEndpointSummaryById(endpointId: number, userId?: number) {
  const query = db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
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

export interface CreateEndpointParams {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  requestSchema: any;
  responseSchema: any;
  parameters: any;
  tags: string[];
}

export interface UpdateEndpointParams {
  id: number;
  operationId?: string;
  summary?: string;
  description?: string;
  requestSchema: any;
  responseSchema: any;
  parameters: any;
  tags: string[];
}

export async function createApiEndpoints(apiId: number, endpoints: CreateEndpointParams[]) {
  if (endpoints.length === 0) {
    return [];
  }

  const endpointValues = endpoints.map((endpoint) => ({
    apiId,
    path: endpoint.path,
    method: endpoint.method,
    operationId: endpoint.operationId || null,
    summary: endpoint.summary || null,
    description: endpoint.description || null,
    requestSchema: endpoint.requestSchema,
    responseSchema: endpoint.responseSchema,
    parameters: endpoint.parameters,
    tags: endpoint.tags
  }));

  const createdEndpoints = await db.insert(apiEndpoints).values(endpointValues).returning();

  // Automatically create embeddings for the created endpoints
  if (createdEndpoints.length > 0) {
    try {
      // Get API information for embedding processing
      const api = await db
        .select({
          id: apis.id,
          name: apis.name,
          description: apis.description,
          userId: apis.userId
        })
        .from(apis)
        .where(eq(apis.id, apiId))
        .limit(1);

      if (api.length > 0) {
        const embeddingService = new EndpointEmbeddingsService();
        await embeddingService.batchProcessEndpoints(
          createdEndpoints,
          api[0].name,
          api[0].description || undefined,
          api[0].userId || undefined
        );
      }
    } catch (error) {
      console.error('Error creating embeddings for new endpoints:', error);
      // Continue execution - embeddings are not critical for endpoint creation
    }
  }

  return createdEndpoints;
}

export async function updateApiEndpoint(params: UpdateEndpointParams) {
  await db
    .update(apiEndpoints)
    .set({
      operationId: params.operationId || null,
      summary: params.summary || null,
      description: params.description || null,
      requestSchema: params.requestSchema,
      responseSchema: params.responseSchema,
      parameters: params.parameters,
      tags: params.tags
    })
    .where(eq(apiEndpoints.id, params.id));

  // Automatically update embeddings for the updated endpoint
  try {
    // Get the updated endpoint with API information for embedding processing
    const updatedEndpoint = await db
      .select({
        endpoint: apiEndpoints,
        api: {
          id: apis.id,
          name: apis.name,
          description: apis.description,
          userId: apis.userId
        }
      })
      .from(apiEndpoints)
      .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
      .where(eq(apiEndpoints.id, params.id))
      .limit(1);

    if (updatedEndpoint.length > 0) {
      const embeddingService = new EndpointEmbeddingsService();
      await embeddingService.processEndpoint(
        updatedEndpoint[0].endpoint,
        updatedEndpoint[0].api.name,
        updatedEndpoint[0].api.description || undefined,
        updatedEndpoint[0].api.userId || undefined
      );
    }
  } catch (error) {
    console.error('Error updating embedding for updated endpoint:', error);
    // Continue execution - embeddings are not critical for endpoint updates
  }
}

export async function deleteApiEndpoints(endpointIds: number[]) {
  if (endpointIds.length === 0) {
    return;
  }
  
  await db
    .delete(apiEndpoints)
    .where(inArray(apiEndpoints.id, endpointIds));
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