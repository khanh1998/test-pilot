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

  return await db.insert(apiEndpoints).values(endpointValues).returning();
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