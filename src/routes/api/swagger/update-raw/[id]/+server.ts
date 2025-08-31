import { json } from '@sveltejs/kit';
import { updateSwagger } from '$lib/server/service/apis/update_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals, params, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiId = params.id;
    if (!apiId) {
      return new Response(JSON.stringify({ error: 'API ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get file name from query string
    const fileName = url.searchParams.get('fileName') || 'swagger-spec';
    const userProvidedHost = url.searchParams.get('host') || '';

    // Read the raw file data from the request body
    const fileBuffer = await request.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    // Create a File-like object for processing
    const file = new File([fileContent], fileName, {
      type: fileName.endsWith('.json') ? 'application/json' : 'application/x-yaml'
    });

    // Process the swagger file
    const { content, format } = await processSwaggerFile({
      file,
      userProvidedHost
    });

    // Update the swagger specification
    const result = await updateSwagger({
      apiId: Number(apiId),
      content,
      format,
      userProvidedHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error updating Swagger/OpenAPI spec via raw upload:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to update Swagger/OpenAPI spec',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
