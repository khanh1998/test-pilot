import { parseFormRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import { updateSwagger } from '$lib/server/service/apis/update_swagger';
import { processSwaggerFile } from '$lib/server/service/apis/swagger_file_processor';
import type { RequestEvent } from '@sveltejs/kit';
import { swaggerApiIdParam, SwaggerUpdateForm } from '$lib/schemas/swagger';

export async function POST({ request, locals, params }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = swaggerApiIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid API ID' }, { status: 400 });

  try {
    const parsed = await parseFormRequest(request, SwaggerUpdateForm);
    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });
    const file = parsed.data.swaggerFile;
    const userProvidedHost = parsed.data.host;

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
    console.error('Error updating API from Swagger/OpenAPI spec:', error);
    if (
      error instanceof Error &&
      (error.message.includes('not found') || error.message.includes('permission'))
    ) {
      return json({ error: error.message }, { status: 404 });
    }
    return json(
      { error: error instanceof Error ? error.message : 'Failed to update API' },
      { status: 500 }
    );
  }
}
