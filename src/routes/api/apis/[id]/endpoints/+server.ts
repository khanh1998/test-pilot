import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Get the API and check if it belongs to the user
    const api = await db
      .select()
      .from(apis)
      .where(and(eq(apis.id, apiId), eq(apis.userId, locals.user.userId)))
      .limit(1)
      .then((results) => results[0] || null);

    if (!api) {
      return new Response(JSON.stringify({ error: 'API not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all endpoints for the API
    const endpoints = await db
      .select()
      .from(apiEndpoints)
      .where(eq(apiEndpoints.apiId, apiId))
      .orderBy(apiEndpoints.path, apiEndpoints.method);

    return json({
      api: {
        id: api.id,
        name: api.name,
        description: api.description,
        host: api.host,
        createdAt: api.createdAt,
        updatedAt: api.updatedAt
      },
      endpoints
    });
  } catch (error) {
    console.error('Error retrieving API endpoints:', error);
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
