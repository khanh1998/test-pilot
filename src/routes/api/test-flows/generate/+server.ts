import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { generateTestFlow } from '$lib/server/service/test_flows/test-flow-generation';

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
    // Generate test flow using the merged service that handles both endpoint fetching and flow creation
    const newFlow = await generateTestFlow(endpointIds, description, Number(userId));
    
    return json({
      success: true,
      data: newFlow
    });
  } catch (err: unknown) {
    console.error('Error generating test flow:', err);
    if (err instanceof Error) {
      if (err.message === 'No valid endpoints found for the given IDs') {
        throw error(404, 'No valid endpoints found');
      }
      throw error(500, `Failed to generate test flow: ${err.message}`);
    } else {
      throw error(500, 'Failed to generate test flow: Unknown error');
    }
  }
};
