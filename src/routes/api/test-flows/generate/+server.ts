import { json } from '@sveltejs/kit';
import { fetchApiEndpoints } from '$lib/server/service/api_endpoints/api-endpoints';
import { error } from '@sveltejs/kit';
import { createTestFlow } from '$lib/server/service/test_flows/test_flow';

interface RequestLocals {
  getUserId: () => string | null;
}

interface GenerateFlowRequest {
  endpointIds: number[];
  description: string;
}

export const POST = async ({ request, locals }: { request: Request; locals: RequestLocals }) => {
  const userId = locals.getUserId();
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const data = await request.json() as GenerateFlowRequest;
  const { endpointIds, description } = data;
  
  // Validate input
  if (!Array.isArray(endpointIds) || endpointIds.length === 0) {
    throw error(400, 'endpointIds must be a non-empty array');
  }
  
  if (!description || typeof description !== 'string') {
    throw error(400, 'description is required and must be a string');
  }

  try {
    // Fetch API endpoint specifications from database
    const endpoints = await fetchApiEndpoints(endpointIds);
    
    if (endpoints.length === 0) {
      throw error(404, 'No valid endpoints found');
    }
    
    // Convert nullable fields to undefined for compatibility with ApiEndpoint type
    const formattedEndpoints = endpoints.map(endpoint => ({
      ...endpoint,
      operationId: endpoint.operationId || undefined,
      summary: endpoint.summary || undefined,
      description: endpoint.description || undefined,
      parameters: endpoint.parameters || undefined,
      requestSchema: endpoint.requestSchema || undefined,
      responseSchema: endpoint.responseSchema || undefined,
      method: endpoint.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
    }));
    
    // Generate test flow using OpenAI and save to database with settings and mappings
    const newFlow = await createTestFlow(formattedEndpoints, description, Number(userId));
    
    return json({
      success: true,
      data: newFlow
    });
  } catch (err: unknown) {
    console.error('Error generating test flow:', err);
    if (err instanceof Error) {
      throw error(500, `Failed to generate test flow: ${err.message}`);
    } else {
      throw error(500, 'Failed to generate test flow: Unknown error');
    }
  }
};
