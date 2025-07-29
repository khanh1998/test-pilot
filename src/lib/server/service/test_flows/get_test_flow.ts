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
