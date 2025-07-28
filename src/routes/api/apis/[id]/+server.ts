import { json } from '@sveltejs/kit';
import { getApiDetails } from '$lib/server/service/apis/get_api_details';
import { deleteApi } from '$lib/server/service/apis/delete_api';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiId = parseInt(params.id || '0');

    if (isNaN(apiId) || apiId <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid API ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await getApiDetails({
      apiId,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error retrieving API:', error);
    
    if (error instanceof Error) {
      if (error.message === 'API not found') {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (error.message === 'Unauthorized to access this API') {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve API',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiId = parseInt(params.id || '0');

    if (isNaN(apiId) || apiId <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid API ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await deleteApi({
      apiId,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error deleting API:', error);
    
    if (error instanceof Error) {
      if (error.message === 'API not found') {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (error.message === 'Unauthorized to delete this API') {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to delete API',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
