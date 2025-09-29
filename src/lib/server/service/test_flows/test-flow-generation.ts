import { db } from '$lib/server/db';
import { testFlowApis, apis, testFlows } from '$lib/server/db/schema';
import { generateTestFlowFromSpec } from '$lib/server/repository/openai/flow-generator';
import { eq, inArray } from 'drizzle-orm';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';
import { createTestFlowApis } from '$lib/server/repository/db/test-flows';

interface ApiEndpoint {
  id: number;
  apiId: number;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any;
  requestSchema?: any;
  responseSchema?: any;
  tags?: string[];
  createdAt: Date;
}

interface TestFlowGenerationResult {
  id: number;
  name: string;
  description: string;
  createdAt: Date;
}

/**
 * Fetches API endpoints by their IDs with optional user filtering
 */
export async function fetchEndpointsForFlow(endpointIds: number[], userId?: number): Promise<ApiEndpoint[]> {
  if (!Array.isArray(endpointIds) || endpointIds.length === 0) {
    return [];
  }

  const endpoints = await apiEndpointsRepo.getApiEndpointsByIds(endpointIds, userId);
  
  // Convert nullable fields to undefined for compatibility with ApiEndpoint type
  return endpoints.map(endpoint => ({
    ...endpoint,
    operationId: endpoint.operationId || undefined,
    summary: endpoint.summary || undefined,
    description: endpoint.description || undefined,
    parameters: endpoint.parameters || undefined,
    requestSchema: endpoint.requestSchema || undefined,
    responseSchema: endpoint.responseSchema || undefined,
    tags: endpoint.tags || undefined,
    method: endpoint.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
  }));
}

/**
 * Generates a complete test flow from endpoints
 * This function combines endpoint fetching and test flow creation
 */
export async function generateTestFlow(
  endpointIds: number[],
  description: string,
  userId: number,
  projectId?: number
): Promise<TestFlowGenerationResult> {
  // Fetch and validate endpoints
  const endpoints = await fetchEndpointsForFlow(endpointIds, userId);
  
  if (endpoints.length === 0) {
    throw new Error('No valid endpoints found for the given IDs');
  }

  // Generate test flow using OpenAI
  const flowJson = await generateTestFlowFromSpec(endpoints, description);
  
  // Use the name and description from the generated flow
  const name = flowJson.name;
  const flowDescription = flowJson.description;
  
  // Store the generated flow in database
  const [newFlow] = await db.insert(testFlows).values({
    name,
    description: flowDescription,
    flowJson,
    userId,
    projectId
  }).returning();

  // Add settings info to flow - get unique API IDs from endpoints
  const uniqueApiIds = [...new Set(endpoints.map(e => e.apiId))];
  const apiHosts = await fetchApiHosts(uniqueApiIds);
  
  const finalFlowJson = {
    ...flowJson,
    settings: {
      api_hosts: apiHosts
    }
  };

  // Update the flow with settings
  await db.update(testFlows)
    .set({ flowJson: finalFlowJson })
    .where(eq(testFlows.id, newFlow.id));

  // Create API mappings
  await createTestFlowApis(newFlow.id, uniqueApiIds);
  
  return {
    id: newFlow.id,
    name: newFlow.name,
    description: newFlow.description || flowDescription,
    createdAt: newFlow.createdAt
  };
}

/**
 * Fetch API host information for settings
 * This function is reusable for any scenario where API host info is needed
 */
export async function fetchApiHosts(apiIds: number[]): Promise<Record<string, { url: string; name: string }>> {
  if (apiIds.length === 0) {
    return {};
  }

  const apiData = await db
    .select({
      id: apis.id,
      name: apis.name,
      host: apis.host
    })
    .from(apis)
    .where(inArray(apis.id, apiIds));
  
  const apiHosts: Record<string, { url: string; name: string }> = {};
  
  apiData.forEach((api) => {
    apiHosts[api.id.toString()] = {
      url: api.host || 'http://localhost:3000', // fallback URL
      name: api.name
    };
  });
  
  return apiHosts;
}
