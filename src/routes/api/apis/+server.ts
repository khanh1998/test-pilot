import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all APIs for the current user
    const userApis = await db
      .select()
      .from(apis)
      .where(eq(apis.userId, locals.user.userId))
      .orderBy(apis.createdAt);

    // Get counts using a separate query with a join to count endpoints
    const countByApiId: Record<number, number> = {};

    if (userApis.length > 0) {
      // Use Drizzle's inArray operator for proper parameter binding
      const apiIds = userApis.map((api) => api.id);
      const endpointCounts = await db
        .select({
          apiId: apiEndpoints.apiId,
          count: sql<number>`count(*)::int`
        })
        .from(apiEndpoints)
        .where(inArray(apiEndpoints.apiId, apiIds))
        .groupBy(apiEndpoints.apiId);

      // Create a map of API ID to endpoint count
      endpointCounts.forEach((count) => {
        countByApiId[count.apiId] = count.count;
      });
    }

    // Format the response
    const formattedApis = userApis.map((api) => ({
      id: api.id,
      name: api.name,
      description: api.description,
      host: api.host,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt,
      endpointCount: countByApiId[api.id] || 0
    }));

    return json({ apis: formattedApis });
  } catch (error) {
    console.error('Error retrieving APIs:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve APIs',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}


