// Test for extractUsedEndpointIds function
export function extractUsedEndpointIds(flowJson: any): number[] {
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

// Test the function
const testFlowJson = {
  steps: [
    {
      step_id: "step1",
      endpoints: [
        { endpoint_id: 101, api_id: 1 },
        { endpoint_id: 102, api_id: 1 }
      ]
    },
    {
      step_id: "step2", 
      endpoints: [
        { endpoint_id: 103, api_id: 2 },
        { endpoint_id: 101, api_id: 1 } // duplicate
      ]
    }
  ]
};

const result = extractUsedEndpointIds(testFlowJson);
console.log('Used endpoint IDs:', result); // Should be [101, 102, 103]

export { result as testResult };
