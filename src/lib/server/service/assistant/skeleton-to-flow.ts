import type { EnrichedSkeletonTestFlow } from "$lib/http_client/assistant";
import type { TestFlowGen } from "$lib/server/repository/openai/flow-zod-gen-schema";
import { enrichEndpointFromSkeleton } from "$lib/server/repository/openai/skeleton-to-flow";
import { getApiEndpointById } from "$lib/server/repository/db/api-endpoints";
import { db } from '$lib/server/db';
import { testFlows, testFlowApis, apis } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface ProcessingNode {
  stepIndex: number;
  itemIndex: number;
  apiInfoItem: any;
  dependencies: string[];
  processed: boolean;
}

// Helper function to get default values for parameter types
function getDefaultValueForType(type: string): string | number | boolean | (string | number | boolean | null)[] | null {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return null; // Objects are complex, use null as default
    case 'null':
    default:
      return null;
  }
}

// Analyze dependencies and return processing order
function analyzeDependencies(skeleton: EnrichedSkeletonTestFlow): ProcessingNode[] {
  const nodes: ProcessingNode[] = [];
  
  // Create nodes for all API info items
  skeleton.steps.forEach((step, stepIndex) => {
    step.apiInfoItems.forEach((apiInfoItem, itemIndex) => {
      nodes.push({
        stepIndex,
        itemIndex,
        apiInfoItem,
        dependencies: apiInfoItem.dependsOn || [],
        processed: false
      });
    });
  });
  
  // Sort by dependency order (topological sort)
  const sortedNodes: ProcessingNode[] = [];
  const visited = new Set<string>();
  
  function visitNode(node: ProcessingNode) {
    if (visited.has(node.apiInfoItem.id)) return;
    visited.add(node.apiInfoItem.id);
    
    // First process all dependencies
    node.dependencies.forEach(depId => {
      const depNode = nodes.find(n => n.apiInfoItem.id === depId);
      if (depNode && !visited.has(depId)) {
        visitNode(depNode);
      }
    });
    
    sortedNodes.push(node);
  }
  
  // Visit all nodes
  nodes.forEach(node => visitNode(node));
  
  return sortedNodes;
}

// Get endpoint specs for dependencies
async function getDependentEndpointSpecs(dependencyIds: string[], processedEndpoints: Map<string, any>): Promise<any[]> {
  const dependentSpecs: any[] = [];
  
  for (const depId of dependencyIds) {
    const processedEndpoint = processedEndpoints.get(depId);
    if (processedEndpoint) {
      dependentSpecs.push({
        id: depId,
        endpoint: processedEndpoint.endpoint,
        enrichedData: processedEndpoint.enrichedData
      });
    }
  }
  
  return dependentSpecs;
}

export async function generateTestFlowFromSkeleton(skeleton: EnrichedSkeletonTestFlow, userId?: number): Promise<TestFlowGen> {
  console.log('Starting test flow generation from skeleton:', skeleton.name);
  
  // Validate input
  if (!skeleton || !skeleton.steps || skeleton.steps.length === 0) {
    throw new Error('Invalid skeleton: must have at least one step');
  }
  
  // Check if any endpoints are assigned
  const hasEndpoints = skeleton.steps.some(step => 
    step.apiInfoItems.some(item => item.endpoint?.id)
  );
  
  if (!hasEndpoints) {
    throw new Error('No endpoints found in skeleton. Please assign endpoints to the skeleton first.');
  }
  
  // Analyze dependencies to determine processing order
  const processingOrder = analyzeDependencies(skeleton);
  console.log('Processing order determined:', processingOrder.map(n => n.apiInfoItem.id));
  
  // Track processed endpoints and their enriched data
  const processedEndpoints = new Map<string, any>();
  
  // Create the final test flow structure
  const testFlow: TestFlowGen = {
    name: skeleton.name,
    description: skeleton.description,
    steps: skeleton.steps.map(step => ({
      label: step.description,
      step_id: step.id,
      endpoints: []
    })),
    parameters: (skeleton.parameters || []).map(param => ({
      name: param.name,
      type: param.type,
      required: param.required,
      description: `Parameter for ${param.name}`,
      value: getDefaultValueForType(param.type),
      defaultValue: getDefaultValueForType(param.type)
    }))
  };
  
  // Process each endpoint in dependency order
  for (const node of processingOrder) {
    const { stepIndex, itemIndex, apiInfoItem } = node;
    
    console.log(`Processing endpoint: ${apiInfoItem.id}`);
    
    try {
      // Get the endpoint from the enriched skeleton (should have endpoint data from previous enrichment)
      if (!apiInfoItem.endpoint || !apiInfoItem.endpoint.id) {
        console.warn(`No endpoint found for API info item: ${apiInfoItem.id}`);
        continue;
      }
      
      // Fetch full endpoint specification from database
      const endpointSpec = await getApiEndpointById(apiInfoItem.endpoint.id, userId);
      
      if (!endpointSpec) {
        console.warn(`Endpoint spec not found for ID: ${apiInfoItem.endpoint.id}`);
        continue;
      }
      
      // Get specs of dependent endpoints
      const dependentSpecs = await getDependentEndpointSpecs(apiInfoItem.dependsOn || [], processedEndpoints);
      
      // Enrich the endpoint using OpenAI
      const enrichedEndpoint = await enrichEndpointFromSkeleton({
        apiInfoItem,
        endpointSpec,
        flowParameters: skeleton.parameters || [],
        dependentEndpoints: dependentSpecs,
        flowDescription: skeleton.description
      });
      
      // Store the processed endpoint
      processedEndpoints.set(apiInfoItem.id, {
        endpoint: endpointSpec,
        enrichedData: enrichedEndpoint
      });
      
      // Add the enriched endpoint to the appropriate step
      if (testFlow.steps[stepIndex]) {
        testFlow.steps[stepIndex].endpoints.push(enrichedEndpoint);
      }
      
      console.log(`Successfully enriched endpoint: ${apiInfoItem.id}`);
      
    } catch (error) {
      console.error(`Error processing endpoint ${apiInfoItem.id}:`, error);
      // Continue processing other endpoints even if one fails
    }
  }
  
  console.log('Test flow generation completed');
  
  // Save the test flow to database if userId is provided
  if (userId) {
    console.log('Saving test flow to database...');
    
    try {
      // Collect unique API IDs from the enriched endpoints
      const apiIds = new Set<number>();
      testFlow.steps.forEach(step => {
        step.endpoints.forEach(endpoint => {
          apiIds.add(endpoint.api_id);
        });
      });
      
      // Fetch API host information for settings
      const apiHosts: Record<string, { url: string; name: string }> = {};
      if (apiIds.size > 0) {
        const apiList = await db
          .select({
            id: apis.id,
            name: apis.name,
            host: apis.host
          })
          .from(apis)
          .where(eq(apis.userId, userId));
        
        apiList.forEach(api => {
          if (api.host) {
            apiHosts[api.id] = {
              url: api.host,
              name: api.name
            };
          }
        });
      }
      
      // Create the final flow JSON with settings
      const finalFlowJson = {
        ...testFlow,
        settings: {
          api_hosts: apiHosts
        }
      };
      
      // Insert the test flow into database
      const [newTestFlow] = await db
        .insert(testFlows)
        .values({
          name: testFlow.name,
          description: testFlow.description,
          userId,
          flowJson: finalFlowJson
        })
        .returning();
      
      // Create API mappings
      if (apiIds.size > 0 && newTestFlow) {
        const mappings = Array.from(apiIds).map(apiId => ({
          testFlowId: newTestFlow.id,
          apiId
        }));
        
        await db.insert(testFlowApis).values(mappings);
      }
      
      console.log(`Test flow saved with ID: ${newTestFlow?.id}`);
    } catch (error) {
      console.error('Error saving test flow to database:', error);
      // Don't throw error here, return the flow anyway
    }
  }
  
  return testFlow;
}