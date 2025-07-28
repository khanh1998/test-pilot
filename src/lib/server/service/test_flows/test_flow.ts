import { db } from '$lib/server/db';
import { testFlowApis, apis, testFlows } from '$lib/server/db/schema';
import { generateTestFlowFromSpec } from '$lib/server/repository/openai/flow-generator';
import { eq, inArray } from 'drizzle-orm';
import { getTestFlowById, getEndpointsByIds } from '$lib/server/repository/db/test-flows';

export async function getTestFlow(id: number, userId: number) {
  // Get the test flow with its APIs
  const testFlowData = await getTestFlowById(id, userId);
  
  if (!testFlowData) {
    return null;
  }

  // Extract used endpoint IDs from the test flow JSON
  const usedEndpointIds = extractUsedEndpointIds(testFlowData.flowJson);
  
  // Get only the endpoints that are actually used in the test flow
  const endpoints = await getEndpointsByIds(usedEndpointIds);

  return {
    testFlow: {
      ...testFlowData,
      endpoints
    }
  };
}

// Helper function to extract used endpoint IDs from test flow JSON
function extractUsedEndpointIds(flowJson: any): number[] {
  const endpointIds = new Set<number>();
  
  if (flowJson?.steps && Array.isArray(flowJson.steps)) {
    for (const step of flowJson.steps) {
      if (step.endpoints && Array.isArray(step.endpoints)) {
        for (const endpoint of step.endpoints) {
          if (endpoint.endpoint_id && typeof endpoint.endpoint_id === 'number') {
            endpointIds.add(endpoint.endpoint_id);
          }
        }
      }
    }
  }
  
  return Array.from(endpointIds);
}

// Service function to create a complete test flow with database operations
export async function createTestFlow(
  endpoints: any[],
  description: string,
  userId: number
): Promise<{ id: number; name: string; description: string; createdAt: Date }> {
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
    userId
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
  await createTestFlowApiMappings(newFlow.id, uniqueApiIds);
  
  return {
    id: newFlow.id,
    name: newFlow.name,
    description: newFlow.description || flowDescription,
    createdAt: newFlow.createdAt
  };
}



// Fetch API host information for settings
async function fetchApiHosts(apiIds: number[]): Promise<Record<string, { url: string; name: string }>> {
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

// Create mappings between test flow and APIs
async function createTestFlowApiMappings(testFlowId: number, apiIds: number[]): Promise<void> {
  // Remove existing mappings for this test flow
  await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, testFlowId));
  
  // Insert new mappings
  if (apiIds.length > 0) {
    const mappings = apiIds.map(apiId => ({
      testFlowId,
      apiId
    }));
    
    await db.insert(testFlowApis).values(mappings);
  }
}