import { db } from '$lib/server/db';
import { testFlows, testFlowApis, apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, and, inArray, desc, ilike, or, count } from 'drizzle-orm';

export interface TestFlowWithApis {
  id: number;
  name: string;
  description: string | null;
  flowJson: any;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
  apis: Array<{
    id: number;
    name: string;
  }>;
}

export interface TestFlowListItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  apis: Array<{
    id: number;
    name: string;
  }>;
}

export interface EndpointInfo {
  id: number;
  apiId: number;
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any;
  requestSchema?: any;
  responseSchema?: any;
  tags?: string[];
}

/**
 * Get basic test flow data for a user (without API associations)
 * @param userId - The user ID
 * @param options - Pagination and filtering options
 * @returns Object with test flows array and pagination info
 */
export async function getUserTestFlows(
  userId: number, 
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<{
  testFlows: Array<{
    id: number;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}> {
  const { limit = 20, offset = 0, search } = options;

  // Build the base query
  let whereConditions = eq(testFlows.userId, userId);
  
  // Add search condition if provided
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    const searchCondition = or(
      ilike(testFlows.name, searchTerm),
      ilike(testFlows.description, searchTerm)
    );
    whereConditions = and(whereConditions, searchCondition)!;
  }

  // Get the total count
  const totalResult = await db
    .select({ count: count() })
    .from(testFlows)
    .where(whereConditions);
  
  const total = totalResult[0]?.count || 0;

  // Get the paginated results
  const testFlowsResult = await db
    .select({
      id: testFlows.id,
      name: testFlows.name,
      description: testFlows.description,
      createdAt: testFlows.createdAt,
      updatedAt: testFlows.updatedAt
    })
    .from(testFlows)
    .where(whereConditions)
    .orderBy(desc(testFlows.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    testFlows: testFlowsResult,
    total
  };
}

/**
 * Get API associations for multiple test flows
 * @param testFlowIds - Array of test flow IDs
 * @returns Array of test flow API associations
 */
export async function getMultipleTestFlowApiAssociations(testFlowIds: number[]): Promise<Array<{
  testFlowId: number;
  apiId: number;
  apiName: string;
}>> {
  if (testFlowIds.length === 0) {
    return [];
  }

  return db
    .select({
      testFlowId: testFlowApis.testFlowId,
      apiId: testFlowApis.apiId,
      apiName: apis.name
    })
    .from(testFlowApis)
    .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
    .where(inArray(testFlowApis.testFlowId, testFlowIds));
}

// Get a test flow by ID and user ID
export async function getTestFlowById(id: number, userId: number): Promise<TestFlowWithApis | null> {
  const [testFlow] = await db
    .select()
    .from(testFlows)
    .where(and(eq(testFlows.id, id), eq(testFlows.userId, userId)));

  if (!testFlow) {
    return null;
  }

  // Get associated APIs
  const associatedApis = await db
    .select({
      id: apis.id,
      name: apis.name
    })
    .from(testFlowApis)
    .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
    .where(eq(testFlowApis.testFlowId, id));

  return {
    ...testFlow,
    apis: associatedApis
  };
}

// Get endpoints by their IDs
export async function getEndpointsByIds(endpointIds: number[]): Promise<EndpointInfo[]> {
  if (endpointIds.length === 0) {
    return [];
  }

  const dbEndpoints = await db
    .select({
      id: apiEndpoints.id,
      apiId: apiEndpoints.apiId,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      operationId: apiEndpoints.operationId,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      parameters: apiEndpoints.parameters,
      requestSchema: apiEndpoints.requestSchema,
      responseSchema: apiEndpoints.responseSchema,
      tags: apiEndpoints.tags
    })
    .from(apiEndpoints)
    .where(inArray(apiEndpoints.id, endpointIds));

  // Map the database results to match the expected type
  return dbEndpoints.map((endpoint) => ({
    id: endpoint.id,
    apiId: endpoint.apiId,
    path: endpoint.path,
    method: endpoint.method,
    operationId: endpoint.operationId || undefined,
    summary: endpoint.summary || undefined,
    description: endpoint.description || undefined,
    parameters: endpoint.parameters || undefined,
    requestSchema: endpoint.requestSchema,
    responseSchema: endpoint.responseSchema,
    tags: endpoint.tags || undefined
  }));
}

/**
 * Get API associations for a test flow
 * @param testFlowId - The test flow ID
 * @returns Array of associated APIs
 */
export async function getTestFlowApiAssociations(testFlowId: number): Promise<Array<{ id: number; name: string }>> {
  return db
    .select({
      id: apis.id,
      name: apis.name
    })
    .from(testFlowApis)
    .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
    .where(eq(testFlowApis.testFlowId, testFlowId));
}

/**
 * Check if a test flow exists and belongs to a user
 * @param testFlowId - The test flow ID
 * @param userId - The user ID
 * @returns True if the test flow exists and belongs to the user
 */
export async function testFlowExistsForUser(testFlowId: number, userId: number): Promise<boolean> {
  const [result] = await db
    .select({ id: testFlows.id })
    .from(testFlows)
    .where(and(eq(testFlows.id, testFlowId), eq(testFlows.userId, userId)))
    .limit(1);
  
  return !!result;
}

/**
 * Validate that APIs exist and belong to a user
 * @param apiIds - Array of API IDs to validate
 * @param userId - The user ID
 * @returns Array of valid API IDs that exist and belong to the user
 */
export async function validateUserApis(apiIds: number[], userId: number): Promise<number[]> {
  if (apiIds.length === 0) {
    return [];
  }

  const userApis = await db
    .select({ id: apis.id })
    .from(apis)
    .where(and(eq(apis.userId, userId), inArray(apis.id, apiIds)));

  return userApis.map(api => api.id);
}

/**
 * Update API associations for a test flow
 * @param testFlowId - The test flow ID
 * @param apiIds - Array of API IDs to associate with the test flow
 */
export async function updateTestFlowApis(testFlowId: number, apiIds: number[]): Promise<void> {
  // Delete existing associations
  await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, testFlowId));

  // Insert new associations
  if (apiIds.length > 0) {
    await db.insert(testFlowApis).values(
      apiIds.map((apiId) => ({
        testFlowId,
        apiId
      }))
    );
  }
}

/**
 * Delete all API associations for a test flow
 * @param testFlowId - The test flow ID
 */
export async function deleteTestFlowApis(testFlowId: number): Promise<void> {
  await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, testFlowId));
}

/**
 * Create API associations for a test flow
 * @param testFlowId - The test flow ID
 * @param apiIds - Array of API IDs to associate with the test flow
 */
export async function createTestFlowApis(testFlowId: number, apiIds: number[]): Promise<void> {
  if (apiIds.length > 0) {
    await db.insert(testFlowApis).values(
      apiIds.map((apiId) => ({
        testFlowId,
        apiId
      }))
    );
  }
}
