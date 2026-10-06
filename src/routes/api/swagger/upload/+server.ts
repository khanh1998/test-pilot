import { json } from '@sveltejs/kit';
import { uploadSwagger } from '$lib/server/service/apis/upload_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';
import { SwaggerUploadForm } from '$lib/schemas/swagger';
import { parseFormRequest } from '$lib/server/http/parse-json-request';

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = await parseFormRequest(request, SwaggerUploadForm);
    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });
    const file = parsed.data.swaggerFile;

    const { content, format } = await processSwaggerFile({
      file,
      userProvidedHost: parsed.data.host
    });

    const result = await uploadSwagger({
      name: parsed.data.name,
      description: parsed.data.description,
      content,
      format,
      userProvidedHost: parsed.data.host,
      userId: locals.user.userId,
      projectId: parsed.data.projectId
    });

    return json(result);
  } catch (error) {
    console.error('Error uploading Swagger/OpenAPI spec:', error);
    return json(
      {
        error: 'Failed to process Swagger/OpenAPI spec',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
