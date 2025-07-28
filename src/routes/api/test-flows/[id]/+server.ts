import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { testFlows, testFlowApis, apis } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { getTestFlow } from '$lib/server/service/test_flows/test_flow';

// Get a specific test flow by ID
export async function GET({ params, locals }: RequestEvent) {
  try {
    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid test flow ID' }), {
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

    // Get the test flow using the service
    const result = await getTestFlow(id, locals.user.userId);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return json(result);
  } catch (error) {
    console.error('Error fetching test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Update an existing test flow
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    const id = parseInt(params.id || '');

    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid test flow ID' }), {
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

    // Check if the test flow exists and belongs to the user
    const [existingTestFlow] = await db
      .select()
      .from(testFlows)
      .where(and(eq(testFlows.id, id), eq(testFlows.userId, locals.user.userId)));

    if (!existingTestFlow) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await request.json();
    const { name, description, apiIds, flowJson } = body;

    // Validate required fields
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update the test flow
    const [updatedTestFlow] = await db
      .update(testFlows)
      .set({
        name,
        description,
        flowJson: flowJson || existingTestFlow.flowJson,
        updatedAt: new Date()
      })
      .where(eq(testFlows.id, id))
      .returning();

    // Update API associations if provided
    if (apiIds && Array.isArray(apiIds)) {
      // Verify all APIs exist and belong to the user
      const userApis = await db
        .select({ id: apis.id })
        .from(apis)
        .where(and(eq(apis.userId, locals.user.userId), inArray(apis.id, apiIds)));

      if (userApis.length !== apiIds.length) {
        return new Response(
          JSON.stringify({ error: 'One or more APIs not found or do not belong to the user' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Delete existing associations
      await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, id));

      // Insert new associations
      if (apiIds.length > 0) {
        await db.insert(testFlowApis).values(
          apiIds.map((apiId) => ({
            testFlowId: id,
            apiId
          }))
        );
      }

      // Get the updated API associations
      const updatedApis = await db
        .select({
          id: apis.id,
          name: apis.name
        })
        .from(testFlowApis)
        .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
        .where(eq(testFlowApis.testFlowId, id));

      return json({
        testFlow: {
          ...updatedTestFlow,
          apis: updatedApis
        }
      });
    }

    return json({
      testFlow: updatedTestFlow
    });
  } catch (error) {
    console.error('Error updating test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to update test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
