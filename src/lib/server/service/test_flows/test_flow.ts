import { db } from '$lib/server/db';
import { testFlowApis, apis, testFlows } from '$lib/server/db/schema';
import { generateTestFlowFromSpec } from '$lib/server/repository/openai/flow-generator';
import { eq, inArray } from 'drizzle-orm';


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