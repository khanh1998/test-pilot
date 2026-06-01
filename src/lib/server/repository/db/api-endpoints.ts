import { db } from '$lib/server/db';
import { apiEndpoints, apis, endpointEmbeddings } from '$lib/server/db/schema';
import { eq, and, inArray, sql, ilike, or, asc } from 'drizzle-orm';

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

  await db.delete(apiEndpoints).where(inArray(apiEndpoints.id, endpointIds));
}

// Search endpoints using the `search_vector` index in `endpoint_embeddings`.
interface SearchByTsVectorParams {
  query: string;
  userId: number;
  apiId?: number; // optional
  apiIds?: number[]; // optional
  limit: number;
}

export async function searchByTsVector(params: SearchByTsVectorParams) {
  const { query, userId, apiId, apiIds } = params;

  let whereConditions = and(
    eq(endpointEmbeddings.userId, userId),
    sql`${endpointEmbeddings.searchVector} @@ plainto_tsquery('english',${query})`
  );

  if (apiId) {
    whereConditions = and(whereConditions, eq(endpointEmbeddings.apiId, apiId));
  } else if (apiIds && apiIds.length > 0) {
    whereConditions = and(whereConditions, inArray(endpointEmbeddings.apiId, apiIds));
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

interface SearchByMetadataParams {
  query: string;
  userId: number;
  apiId?: number;
  apiIds?: number[];
  limit: number;
}

export async function searchByMetadata(params: SearchByMetadataParams) {
  const { query, userId, apiId, apiIds, limit } = params;
  const searchTerm = `%${query.trim()}%`;

  let whereCondition = and(
    eq(apis.userId, userId),
    or(
      ilike(apiEndpoints.path, searchTerm),
      ilike(apiEndpoints.method, searchTerm),
      ilike(apiEndpoints.operationId, searchTerm),
      ilike(apiEndpoints.summary, searchTerm),
      ilike(apiEndpoints.description, searchTerm),
      sql`exists (
        select 1
        from unnest(${apiEndpoints.tags}) as tag
        where tag ilike ${searchTerm}
      )`
    )
  );

  if (apiId) {
    whereCondition = and(whereCondition, eq(apiEndpoints.apiId, apiId));
  } else if (apiIds && apiIds.length > 0) {
    whereCondition = and(whereCondition, inArray(apiEndpoints.apiId, apiIds));
  }

  return db
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
    .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
    .where(whereCondition)
    .orderBy(asc(apiEndpoints.path), asc(apiEndpoints.method))
    .limit(limit);
}

interface BrowseEndpointsParams {
  userId: number;
  apiId?: number;
  apiIds?: number[];
  tag?: string;
  pathPrefix?: string;
  limit: number;
}

export async function browseEndpoints(params: BrowseEndpointsParams) {
  const { userId, apiId, apiIds, tag, pathPrefix, limit } = params;

  let whereCondition = and(eq(apis.userId, userId));

  if (apiId) {
    whereCondition = and(whereCondition, eq(apiEndpoints.apiId, apiId));
  } else if (apiIds && apiIds.length > 0) {
    whereCondition = and(whereCondition, inArray(apiEndpoints.apiId, apiIds));
  }

  if (tag) {
    whereCondition = and(
      whereCondition,
      sql`exists (
        select 1
        from unnest(${apiEndpoints.tags}) as tag
        where tag ilike ${tag}
      )`
    );
  }

  if (pathPrefix) {
    whereCondition = and(whereCondition, ilike(apiEndpoints.path, `${pathPrefix}%`));
  }

  return db
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
    .innerJoin(apis, eq(apiEndpoints.apiId, apis.id))
    .where(whereCondition)
    .orderBy(asc(apiEndpoints.path), asc(apiEndpoints.method))
    .limit(limit);
}
