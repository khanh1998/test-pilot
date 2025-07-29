import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getTestFlow } from '$lib/server/service/test_flows/get_test_flow';
import { updateTestFlow } from '$lib/server/service/test_flows/update_test_flow';

// Get a specific test flow by ID
export async function GET({ params, locals }: RequestEvent) {
  try {
    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid test flow ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the test flow using the service
    const result = await getTestFlow(id, locals.user.userId);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return json(result);
  } catch (error) {
    console.error('Error fetching test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Update an existing test flow
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid test flow ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, description, apiIds, flowJson } = body;

    // Validate required fields
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to update the test flow
    const result = await updateTestFlow(id, locals.user.userId, {
      name,
      description,
      apiIds,
      flowJson
    });

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return json(result);
  } catch (error) {
    console.error('Error updating test flow:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message.includes('APIs not found')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to update test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
