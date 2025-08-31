import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { cloneTestFlow } from '$lib/server/service/test_flows/clone_test_flow';

// Clone a test flow
export async function POST({ request, locals, params }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const testFlowId = parseInt(params.id as string);
    if (isNaN(testFlowId)) {
      return new Response(JSON.stringify({ error: 'Invalid test flow ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, description } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to clone the test flow
    const result = await cloneTestFlow(testFlowId, locals.user.userId, {
      name: name.trim(),
      description: description?.trim()
    });

    return json(result);
  } catch (error) {
    console.error('Error cloning test flow:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message.includes('not found')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to clone test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
