import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { parseSwaggerSpec, extractEndpoints, extractHost } from '$lib/server/swagger/parser';
import { eq, and, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals, params }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!params.id || isNaN(parseInt(params.id))) {
      return new Response(JSON.stringify({ error: 'Invalid API ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiId = parseInt(params.id);

    // Check if the API exists and belongs to the user
    const existingApi = await db.query.apis.findFirst({
      where: and(eq(apis.id, apiId), eq(apis.userId, locals.user.userId))
    });

    if (!existingApi) {
      return new Response(
        JSON.stringify({ error: 'API not found or you do not have permission to update it' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('swaggerFile') as File | null;
    const userProvidedHost = formData.get('host') as string;

    if (!file) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Determine the format based on file extension or content type
    const fileName = file.name.toLowerCase();
    const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml');
    const format = isYaml ? 'yaml' : 'json';

    // Read the file content
    const content = await file.text();

    // Parse the Swagger/OpenAPI spec
    const api = await parseSwaggerSpec(content, format);

    // Extract host information from the spec
    let hostValue = extractHost(api);

    // If no host in spec but user provided one, use that
    if (!hostValue && userProvidedHost) {
      hostValue = userProvidedHost;
    }

    // Update the API in the database
    await db
      .update(apis)
      .set({
        specFormat: format,
        specContent: content,
        host: hostValue,
        updatedAt: new Date()
      })
      .where(eq(apis.id, apiId));

    // Extract the endpoints from the spec
    const newEndpoints = extractEndpoints(api);

    // Get existing endpoints for this API
    const existingEndpoints = await db.query.apiEndpoints.findMany({
      where: eq(apiEndpoints.apiId, apiId)
    });

    // Create a map of existing endpoints for quick lookup
    const existingEndpointMap = new Map(
      existingEndpoints.map((endpoint) => [`${endpoint.method}:${endpoint.path}`, endpoint])
    );

    // Track which endpoints are processed to determine which ones to delete
    const processedEndpoints = new Set();

    // Process each endpoint from the new spec
    for (const endpoint of newEndpoints) {
      const endpointKey = `${endpoint.method}:${endpoint.path}`;
      processedEndpoints.add(endpointKey);

      const existingEndpoint = existingEndpointMap.get(endpointKey);

      if (existingEndpoint) {
        // Update existing endpoint
        await db
          .update(apiEndpoints)
          .set({
            operationId: endpoint.operationId || null,
            summary: endpoint.summary || null,
            description: endpoint.description || null,
            requestSchema: endpoint.requestSchema,
            responseSchema: endpoint.responseSchema,
            parameters: endpoint.parameters,
            tags: endpoint.tags
          })
          .where(eq(apiEndpoints.id, existingEndpoint.id));
      } else {
        // Insert new endpoint
        await db.insert(apiEndpoints).values({
          apiId,
          path: endpoint.path,
          method: endpoint.method,
          operationId: endpoint.operationId || null,
          summary: endpoint.summary || null,
          description: endpoint.description || null,
          requestSchema: endpoint.requestSchema,
          responseSchema: endpoint.responseSchema,
          parameters: endpoint.parameters,
          tags: endpoint.tags
        });
      }
    }

    // Delete endpoints that no longer exist in the spec
    const endpointsToDelete = existingEndpoints.filter(
      (endpoint) => !processedEndpoints.has(`${endpoint.method}:${endpoint.path}`)
    );

    if (endpointsToDelete.length > 0) {
      await db
        .delete(apiEndpoints)
        .where(sql`${apiEndpoints.id} IN (${endpointsToDelete.map((e) => e.id).join(',')})`);
    }

    return json({
      success: true,
      api: {
        id: apiId,
        name: existingApi.name,
        description: existingApi.description,
        host: hostValue,
        endpointCount: newEndpoints.length,
        updated: true,
        addedEndpoints: newEndpoints.length - existingEndpoints.length + endpointsToDelete.length,
        removedEndpoints: endpointsToDelete.length
      }
    });
  } catch (error) {
    console.error('Error updating API from Swagger/OpenAPI spec:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while processing the API specification'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
