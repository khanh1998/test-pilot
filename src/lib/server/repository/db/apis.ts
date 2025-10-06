import { db } from '$lib/server/db';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

export interface ApiWithEndpointCount {
  id: number;
  name: string;
  description: string | null;
  host: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
  endpointCount: number;
}

export interface CreateApiParams {
  name: string;
  description: string | null;
  specFormat: 'yaml' | 'json';
  specContent: string;
  host: string | null;
  userId: number;
}

export interface UpdateApiParams {
  id: number;
  specFormat: 'yaml' | 'json';
  specContent: string;
  host: string | null;
  updatedAt: Date;
}

export async function createApi(params: CreateApiParams) {
  const [createdApi] = await db
    .insert(apis)
    .values({
      name: params.name,
      description: params.description,
      specFormat: params.specFormat,
      specContent: params.specContent,
      host: params.host,
      userId: params.userId
    })
    .returning();

  if (!createdApi) {
    throw new Error('Failed to create API record');
  }

  return createdApi;
}

export async function updateApi(params: UpdateApiParams) {
  await db
    .update(apis)
    .set({
      specFormat: params.specFormat,
      specContent: params.specContent,
      host: params.host,
      updatedAt: params.updatedAt
    })
    .where(eq(apis.id, params.id));
}

export async function getApiById(apiId: number, userId?: number) {
  const query = db
    .select({
      id: apis.id,
      name: apis.name,
      description: apis.description,
      host: apis.host,
      userId: apis.userId,
      createdAt: apis.createdAt,
      updatedAt: apis.updatedAt
    })
    .from(apis)
    .where(
      userId 
        ? and(eq(apis.id, apiId), eq(apis.userId, userId))
        : eq(apis.id, apiId)
    )
    .limit(1);

  const results = await query;
  return results.length > 0 ? results[0] : null;
}

export async function getApiWithEndpointCount(apiId: number): Promise<ApiWithEndpointCount | null> {
  // Get the API
  const apiResult = await getApiById(apiId);
  if (!apiResult) {
    return null;
  }

  // Get endpoint count
  const endpointCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiEndpoints)
    .where(eq(apiEndpoints.apiId, apiId));

  return {
    ...apiResult,
    endpointCount: endpointCountResult[0].count
  };
}

export async function deleteApiById(apiId: number): Promise<void> {
  // Delete related endpoints first to maintain referential integrity
  await db.delete(apiEndpoints).where(eq(apiEndpoints.apiId, apiId));
  
  // Then delete the API itself
  await db.delete(apis).where(eq(apis.id, apiId));
}

export async function verifyApiOwnership(apiId: number, userId: number): Promise<boolean> {
  const api = await getApiById(apiId);
  return api ? api.userId === userId : false;
}

export async function getApisByUserId(userId: number, projectId?: number) {
  const whereConditions = [eq(apis.userId, userId)];
  
  if (projectId !== undefined) {
    whereConditions.push(eq(apis.projectId, projectId));
  }

  return await db
    .select({
      id: apis.id,
      name: apis.name,
      description: apis.description,
      host: apis.host,
      userId: apis.userId,
      createdAt: apis.createdAt,
      updatedAt: apis.updatedAt
    })
    .from(apis)
    .where(and(...whereConditions))
    .orderBy(apis.createdAt);
}

export async function getApisWithEndpointCounts(userId: number, projectId?: number): Promise<ApiWithEndpointCount[]> {
  // Get all APIs for the user, optionally filtered by project
  const userApis = await getApisByUserId(userId, projectId);

  if (userApis.length === 0) {
    return [];
  }

  // Get endpoint counts for all APIs
  const apiIds = userApis.map((api) => api.id);
  const endpointCounts = await db
    .select({
      apiId: apiEndpoints.apiId,
      count: sql<number>`count(*)::int`
    })
    .from(apiEndpoints)
    .where(inArray(apiEndpoints.apiId, apiIds))
    .groupBy(apiEndpoints.apiId);

  // Create a map of API ID to endpoint count
  const countByApiId: Record<number, number> = {};
  endpointCounts.forEach((count) => {
    countByApiId[count.apiId] = count.count;
  });

  // Combine APIs with their endpoint counts
  return userApis.map((api) => ({
    ...api,
    endpointCount: countByApiId[api.id] || 0
  }));
}

export async function getEndpointCountByApiId(apiId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiEndpoints)
    .where(eq(apiEndpoints.apiId, apiId));

  return result[0]?.count || 0;
}
