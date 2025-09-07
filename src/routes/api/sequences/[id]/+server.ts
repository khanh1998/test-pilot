import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getSequenceService } from '$lib/server/service/sequences/get_sequence';
import { updateSequenceService } from '$lib/server/service/sequences/update_sequence';
import { deleteSequenceService } from '$lib/server/service/sequences/delete_sequence';

// Get a sequence by ID
export async function GET({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sequenceId = parseInt(params.id || '');
    if (isNaN(sequenceId)) {
      return new Response(JSON.stringify({ error: 'Invalid sequence ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await getSequenceService(sequenceId, locals.user.userId);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Sequence not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json(result);
  } catch (error) {
    console.error('Error fetching sequence:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch sequence' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Update a sequence
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sequenceId = parseInt(params.id || '');
    if (isNaN(sequenceId)) {
      return new Response(JSON.stringify({ error: 'Invalid sequence ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, parameters, flows } = body;

    const result = await updateSequenceService(sequenceId, locals.user.userId, {
      name,
      parameters,
      flows
    });

    if (!result) {
      return new Response(JSON.stringify({ error: 'Sequence not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json(result);
  } catch (error) {
    console.error('Error updating sequence:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message.includes('test flows not found')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to update sequence' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Delete a sequence
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sequenceId = parseInt(params.id || '');
    if (isNaN(sequenceId)) {
      return new Response(JSON.stringify({ error: 'Invalid sequence ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await deleteSequenceService(sequenceId, locals.user.userId);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Sequence not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json(result);
  } catch (error) {
    console.error('Error deleting sequence:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete sequence' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
