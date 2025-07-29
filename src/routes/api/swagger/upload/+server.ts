import { json } from '@sveltejs/kit';
import { uploadSwagger } from '$lib/server/service/apis/upload_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
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
    const file = formData.get('swaggerFile') as File | null;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const userProvidedHost = formData.get('host') as string;

    if (!file || !name) {
      return new Response(JSON.stringify({ error: 'File and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
