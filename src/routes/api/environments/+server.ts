import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createEnvironment } from '$lib/server/service/environments/create_environment';
import { getEnvironmentsForUser } from '$lib/server/service/environments/get_environments';
import type { CreateEnvironmentData } from '$lib/types/environment';

export async function GET({ locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const environments = await getEnvironmentsForUser(locals.user.userId);
    return json(environments);
  } catch (err) {
    console.error('Error fetching environments:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch environments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST({ request, locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data: CreateEnvironmentData = await request.json();

    // Validate request body
    if (!data.name || !data.config) {
      return new Response(JSON.stringify({ error: 'Name and config are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const environment = await createEnvironment(locals.user.userId, data);
    return json(environment, { status: 201 });
  } catch (err) {
    console.error('Error creating environment:', err);
    
    if (err instanceof Error) {
      if (err.name === 'EnvironmentValidationError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (err.name === 'EnvironmentCreationError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Failed to create environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
