import { json } from '@sveltejs/kit';
import { updateSwagger } from '$lib/server/service/apis/update_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';
import { swaggerApiIdParam, SwaggerUpdateQuery } from '$lib/schemas/swagger';

export async function POST({ request, locals, params, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = swaggerApiIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid API ID' }, { status: 400 });

  try {
    const parsedQuery = SwaggerUpdateQuery.safeParse({
      fileName: url.searchParams.get('fileName') || undefined,
      host: url.searchParams.get('host') || undefined
    });
    if (!parsedQuery.success)
      return json({ error: parsedQuery.error.issues[0].message }, { status: 400 });
    const { fileName, host: userProvidedHost } = parsedQuery.data;

    const fileBuffer = await request.arrayBuffer();
    const fileContent = new Uint8Array(fileBuffer);

    const file = new File([fileContent], fileName, {
      type: fileName.endsWith('.json') ? 'application/json' : 'application/x-yaml'
    });

    const { content, format } = await processSwaggerFile({ file, userProvidedHost });

    const result = await updateSwagger({
      apiId: parsedParams.data.id,
      content,
      format,
      userProvidedHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error) {
    console.error('Error updating Swagger/OpenAPI spec via raw upload:', error);
    return json(
      {
        error: 'Failed to update Swagger/OpenAPI spec',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
