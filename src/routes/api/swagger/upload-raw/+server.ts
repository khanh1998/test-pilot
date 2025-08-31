import { json } from '@sveltejs/kit';
import { uploadSwagger } from '$lib/server/service/apis/upload_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get parameters from query string (since file is sent as raw body)
    const name = url.searchParams.get('name');
    const description = url.searchParams.get('description') || '';
    const userProvidedHost = url.searchParams.get('host') || '';
    const fileName = url.searchParams.get('fileName') || 'swagger-spec';

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Upload the swagger specification
    const result = await uploadSwagger({
      name,
      description,
      content,
      format,
      userProvidedHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error uploading Swagger/OpenAPI spec via raw upload:', error);
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
