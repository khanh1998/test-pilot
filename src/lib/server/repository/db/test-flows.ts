import { db } from '$lib/server/db';
import { testFlows, testFlowApis, apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

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
