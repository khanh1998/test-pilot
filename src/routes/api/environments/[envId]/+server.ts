import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getEnvironmentForUser } from '$lib/server/service/environments/get_environments';
import { updateEnvironment } from '$lib/server/service/environments/update_environment';
import { deleteEnvironment } from '$lib/server/service/environments/delete_environment';
import type { UpdateEnvironmentData } from '$lib/types/environment';

export async function GET({ params, locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const envId = parseInt(params.envId || '');
  if (isNaN(envId)) {
    return new Response(JSON.stringify({ error: 'Invalid environment ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const environment = await getEnvironmentForUser(envId, locals.user.userId);
    
    if (!environment) {
      return new Response(JSON.stringify({ error: 'Environment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json(environment);
  } catch (err) {
    console.error('Error fetching environment:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const envId = parseInt(params.envId || '');
  if (isNaN(envId)) {
    return new Response(JSON.stringify({ error: 'Invalid environment ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data: UpdateEnvironmentData = await request.json();

    const environment = await updateEnvironment(envId, locals.user.userId, data);
    
    if (!environment) {
      return new Response(JSON.stringify({ error: 'Environment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return json(environment);
  } catch (err) {
    console.error('Error updating environment:', err);
    
    if (err instanceof Error && err.name === 'EnvironmentUpdateError') {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to update environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const envId = parseInt(params.envId || '');
  if (isNaN(envId)) {
    return new Response(JSON.stringify({ error: 'Invalid environment ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await deleteEnvironment(envId, locals.user.userId);
    return json({ success: true, id: envId });
  } catch (err) {
    console.error('Error deleting environment:', err);
    
    if (err instanceof Error && err.name === 'EnvironmentDeletionError') {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to delete environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
