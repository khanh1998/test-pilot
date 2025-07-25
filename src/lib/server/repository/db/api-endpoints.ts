import { db } from '$lib/server/db';
import { apiEndpoints, apis } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

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