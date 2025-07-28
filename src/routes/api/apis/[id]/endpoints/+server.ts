import { json } from '@sveltejs/kit';
import { getApiEndpoints } from '$lib/server/service/api_endpoints/get_api_endpoints';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ params, locals }: RequestEvent) {
  try {
    const apiId = parseInt(params.id || '');

    if (isNaN(apiId)) {
      return new Response(JSON.stringify({ error: 'Invalid API ID' }), {
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

    const result = await getApiEndpoints({
      apiId,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error retrieving API endpoints:', error);
    
    if (error instanceof Error && error.message === 'API not found or access denied') {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve API endpoints',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
