import { json } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { apis, apiEndpoints } from '../../../db/schema';
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

export async function DELETE({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the API ID from the request body
    const { id } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'API ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify that the API belongs to the current user
    const apiToDelete = await db.select().from(apis).where(eq(apis.id, id)).limit(1);

    if (apiToDelete.length === 0) {
      return new Response(JSON.stringify({ error: 'API not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (apiToDelete[0].userId !== locals.user.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized to delete this API' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete related endpoints first
    await db.delete(apiEndpoints).where(eq(apiEndpoints.apiId, id));

    // Then delete the API itself
    await db.delete(apis).where(eq(apis.id, id));

    return json({ success: true, message: 'API and all its endpoints deleted successfully' });
  } catch (error) {
    console.error('Error deleting API:', error);
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
