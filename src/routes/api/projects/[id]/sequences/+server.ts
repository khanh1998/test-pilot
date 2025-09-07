import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createSequenceService } from '$lib/server/service/sequences/create_sequence';
import { listSequencesService } from '$lib/server/service/sequences/list_sequences';

// Get all sequences for a project
export async function GET({ params, locals, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const projectId = parseInt(params.id || '');
    if (isNaN(projectId)) {
      return new Response(JSON.stringify({ error: 'Invalid project ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';

    // Validate parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: 'Invalid pagination parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Use the service to get sequences with pagination
    const result = await listSequencesService(locals.user.userId, {
      projectId,
      limit,
      offset,
      search: search.trim() || undefined
    });

    if (!result) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json({
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit)
    });
  } catch (error) {
    console.error('Error fetching sequences:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch sequences' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create a new sequence in a project
export async function POST({ params, request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const projectId = parseInt(params.id || '');
    if (isNaN(projectId)) {
      return new Response(JSON.stringify({ error: 'Invalid project ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, parameters, flows } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Sequence name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the service to create the sequence
    const result = await createSequenceService(locals.user.userId, {
      name: name.trim(),
      projectId,
      parameters,
      flows
    });

    return json(result);
  } catch (error) {
    console.error('Error creating sequence:', error);
    
    // Handle specific service errors
    if (error instanceof Error) {
      if (error.message.includes('Project not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (error.message.includes('test flows not found')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Failed to create sequence' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
