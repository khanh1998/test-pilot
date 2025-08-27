import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { linkApiToEnvironmentService, unlinkApiFromEnvironmentService } from '$lib/server/service/environments/link_api';

export async function POST({ params, locals }: RequestEvent) {
  // Check authentication
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const envId = parseInt(params.envId || '');
  const apiId = parseInt(params.apiId || '');
  
  if (isNaN(envId) || isNaN(apiId)) {
    return new Response(JSON.stringify({ error: 'Invalid environment or API ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await linkApiToEnvironmentService(envId, apiId);
    return json({ success: true, environmentId: envId, apiId });
  } catch (err) {
    console.error('Error linking API to environment:', err);
    
    if (err instanceof Error && err.name === 'ApiLinkingError') {
      const statusCode = err.message.includes('already linked') ? 409 : 400;
      return new Response(JSON.stringify({ error: err.message }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to link API to environment' }), {
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
  const apiId = parseInt(params.apiId || '');
  
  if (isNaN(envId) || isNaN(apiId)) {
    return new Response(JSON.stringify({ error: 'Invalid environment or API ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await unlinkApiFromEnvironmentService(envId, apiId);
    return json({ success: true, environmentId: envId, apiId });
  } catch (err) {
    console.error('Error unlinking API from environment:', err);
    
    if (err instanceof Error && err.name === 'ApiLinkingError') {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Failed to unlink API from environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
