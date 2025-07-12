import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/drizzle';
import { apis, apiEndpoints } from '$lib/server/db/schema';
import { parseSwaggerSpec, extractEndpoints, extractHost } from '$lib/server/swagger/parser';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const userProvidedHost = formData.get('host') as string;

    if (!file || !name) {
      return new Response(JSON.stringify({ error: 'File and name are required' }), {
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

    // Insert the API into the database
    const [createdApi] = await db
      .insert(apis)
      .values({
        name,
        description,
        specFormat: format,
        specContent: content,
        host: hostValue,
        userId: locals.user.userId
      })
      .returning();

    if (!createdApi) {
      throw new Error('Failed to create API record');
    }

    // Extract the endpoints from the spec
    const endpoints = extractEndpoints(api);

    // Insert the endpoints into the database
    if (endpoints.length > 0) {
      const endpointValues = endpoints.map((endpoint) => ({
        apiId: createdApi.id,
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId || null,
        summary: endpoint.summary || null,
        description: endpoint.description || null,
        requestSchema: endpoint.requestSchema,
        responseSchema: endpoint.responseSchema,
        parameters: endpoint.parameters,
        tags: endpoint.tags
      }));

      await db.insert(apiEndpoints).values(endpointValues);
    }

    return json({
      success: true,
      api: {
        id: createdApi.id,
        name: createdApi.name,
        description: createdApi.description,
        host: createdApi.host,
        endpointCount: endpoints.length
      }
    });
  } catch (error) {
    console.error('Error uploading Swagger/OpenAPI spec:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process Swagger/OpenAPI spec',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
