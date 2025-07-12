import { json } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { testFlows, testFlowApis, apis, apiEndpoints } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { Endpoint, Parameter } from '$lib/features/test-flows/components';

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

    // Get the test flow
    const [testFlow] = await db
      .select()
      .from(testFlows)
      .where(and(eq(testFlows.id, id), eq(testFlows.userId, locals.user.userId)));

    if (!testFlow) {
      return new Response(
        JSON.stringify({ error: 'Test flow not found or does not belong to the user' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get associated APIs
    const associatedApis = await db
      .select({
        id: apis.id,
        name: apis.name
      })
      .from(testFlowApis)
      .innerJoin(apis, eq(testFlowApis.apiId, apis.id))
      .where(eq(testFlowApis.testFlowId, id));

    // Get all endpoints for these APIs
    const apiIds = associatedApis.map((api) => api.id);

    let endpoints: Endpoint[] = [];
    if (apiIds.length > 0) {
      const dbEndpoints = await db
        .select({
          id: apiEndpoints.id,
          apiId: apiEndpoints.apiId,
          path: apiEndpoints.path,
          method: apiEndpoints.method,
          operationId: apiEndpoints.operationId,
          summary: apiEndpoints.summary,
          description: apiEndpoints.description,
          parameters: apiEndpoints.parameters,
          requestSchema: apiEndpoints.requestSchema,
          responseSchema: apiEndpoints.responseSchema,
          tags: apiEndpoints.tags
        })
        .from(apiEndpoints)
        .where(inArray(apiEndpoints.apiId, apiIds));

      // Map the database results to match the expected Endpoint type
      endpoints = dbEndpoints.map((endpoint) => ({
        id: endpoint.id,
        apiId: endpoint.apiId,
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId || undefined, // Convert null to undefined
        summary: endpoint.summary || undefined,
        description: endpoint.description || undefined,
        parameters: endpoint.parameters as Parameter[] | undefined, // Type assertion for parameters
        requestSchema: endpoint.requestSchema,
        responseSchema: endpoint.responseSchema,
        tags: endpoint.tags || undefined
      }));
    }

    return json({
      testFlow: {
        ...testFlow,
        apis: associatedApis,
        endpoints
      }
    });
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
