import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { deleteTestFlow } from '$lib/server/service/test_flows/delete_test_flow';
import { createBasicTestFlow } from '$lib/server/service/test_flows/create_test_flow';
import { getTestFlowsForUser } from '$lib/server/service/test_flows/list_test_flows';

// Get all test flows for the authenticated user
export async function GET({ locals, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 1000) {
      return new Response(JSON.stringify({ error: 'Invalid pagination parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to get test flows with pagination
    const result = await getTestFlowsForUser(locals.user.userId, {
      page,
      limit,
      search: search.trim() || undefined
    });

    return json(result);
  } catch (error) {
    console.error('Error fetching test flows:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch test flows' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create a new test flow
export async function POST({ request, locals }: RequestEvent) {
  try {
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
    if (!name || !apiIds || !Array.isArray(apiIds) || apiIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Name and at least one API are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to create the test flow
    const result = await createBasicTestFlow(locals.user.userId, {
      name,
      description,
      apiIds,
      flowJson
    });

    return json(result);
  } catch (error) {
    console.error('Error creating test flow:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message.includes('APIs not found')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to create test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Delete a test flow
export async function DELETE({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Test flow ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to delete the test flow
    const deleted = await deleteTestFlow(id, locals.user.userId);

    if (!deleted) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return json({ success: true, id });
  } catch (error) {
    console.error('Error deleting test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
