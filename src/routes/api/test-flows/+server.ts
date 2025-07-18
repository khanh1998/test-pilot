import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { testFlows, testFlowApis, apis } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

// Get all test flows for the authenticated user
export async function GET({ locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all test flows for the authenticated user
    const userTestFlows = await db
      .select({
        id: testFlows.id,
        name: testFlows.name,
        description: testFlows.description,
        createdAt: testFlows.createdAt,
        updatedAt: testFlows.updatedAt
      })
      .from(testFlows)
      .where(eq(testFlows.userId, locals.user.userId));

    // Get associated APIs for each test flow
    const testFlowIds = userTestFlows.map((flow) => flow.id);

    if (testFlowIds.length === 0) {
      return json({ testFlows: [] });
    }

    const testFlowApiAssociations = await db
      .select({
        testFlowId: testFlowApis.testFlowId,
        apiId: testFlowApis.apiId,
        apiName: apis.name
      })
      .from(testFlowApis)
      .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
      .where(inArray(testFlowApis.testFlowId, testFlowIds));

    // Group APIs by test flow
    const testFlowApisMap = testFlowApiAssociations.reduce(
      (acc, item) => {
        if (!acc[item.testFlowId]) {
          acc[item.testFlowId] = [];
        }
        acc[item.testFlowId].push({
          id: item.apiId,
          name: item.apiName
        });
        return acc;
      },
      {} as Record<number, { id: number; name: string }[]>
    );

    // Add APIs to each test flow
    const testFlowsWithApis = userTestFlows.map((flow) => ({
      ...flow,
      apis: testFlowApisMap[flow.id] || []
    }));

    return json({ testFlows: testFlowsWithApis });
  } catch (error) {
    console.error('Error fetching test flows:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch test flows' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create a new test flow
export async function POST({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, description, apiIds, flowJson } = body;

    // Validate required fields
    if (!name || !apiIds || !Array.isArray(apiIds) || apiIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Name and at least one API are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Create default flow JSON structure if not provided
    const defaultFlowJson = {
      settings: { api_hosts: {} },
      steps: [],
    };

    // Insert the test flow
    const [newTestFlow] = await db
      .insert(testFlows)
      .values({
        name,
        description,
        userId: locals.user.userId,
        flowJson: flowJson || defaultFlowJson
      })
      .returning();

    // Insert API associations
    if (newTestFlow) {
      await db.insert(testFlowApis).values(
        apiIds.map((apiId) => ({
          testFlowId: newTestFlow.id,
          apiId
        }))
      );
    }

    return json({
      testFlow: {
        ...newTestFlow,
        apis: apiIds.map((id) => ({ id }))
      }
    });
  } catch (error) {
    console.error('Error creating test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to create test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Delete a test flow
export async function DELETE({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Test flow ID is required' }), {
        status: 400,
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

    // Delete test flow API associations first (due to foreign key constraints)
    await db.delete(testFlowApis).where(eq(testFlowApis.testFlowId, id));

    // Delete the test flow
    await db.delete(testFlows).where(eq(testFlows.id, id));

    return json({ success: true, id });
  } catch (error) {
    console.error('Error deleting test flow:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete test flow' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
