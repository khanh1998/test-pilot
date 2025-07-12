import { json } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
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

    // Get the API by ID
    const apiData = await db.select().from(apis).where(eq(apis.id, apiId)).limit(1);

    if (apiData.length === 0) {
      return new Response(JSON.stringify({ error: 'API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify ownership
    if (apiData[0].userId !== locals.user.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to access this API' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get endpoint count
    const endpointCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiEndpoints)
      .where(eq(apiEndpoints.apiId, apiId));

    // Format the response
    const formattedApi = {
      id: apiData[0].id,
      name: apiData[0].name,
      description: apiData[0].description,
      host: apiData[0].host,
      createdAt: apiData[0].createdAt,
      updatedAt: apiData[0].updatedAt,
      endpointCount: endpointCount[0].count
    };

    return json({ api: formattedApi });
  } catch (error) {
    console.error('Error retrieving API:', error);
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
