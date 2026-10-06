import { SwaggerUploadQuery } from '$lib/schemas/swagger';
import { json } from '@sveltejs/kit';
import { uploadSwagger } from '$lib/server/service/apis/upload_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request, locals, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = SwaggerUploadQuery.safeParse({
    name: url.searchParams.get('name'),
    description: url.searchParams.get('description') || '',
    host: url.searchParams.get('host') || '',
    fileName: url.searchParams.get('fileName') || 'swagger-spec',
    projectId: url.searchParams.get('projectId') || undefined
  });

  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const fileBuffer = await request.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    const file = new File([fileContent], parsed.data.fileName, {
      type: parsed.data.fileName.endsWith('.json') ? 'application/json' : 'application/x-yaml'
    });

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
    console.error('Error uploading Swagger/OpenAPI spec via raw upload:', error);
    return json(
      {
        error: 'Failed to process Swagger/OpenAPI spec',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
