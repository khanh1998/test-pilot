import { json } from '@sveltejs/kit';
import { updateSwagger } from '$lib/server/service/apis/update_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
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

    // Process the swagger file
    const { content, format } = await processSwaggerFile({
      file,
      userProvidedHost
    });

    // Update the swagger specification
    const result = await updateSwagger({
      apiId,
      content,
      format,
      userProvidedHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error updating API from Swagger/OpenAPI spec:', error);
    
    // Handle specific error types with appropriate status codes
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('permission')) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred while processing the API specification'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
