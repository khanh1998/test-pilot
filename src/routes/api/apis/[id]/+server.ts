import { json } from '@sveltejs/kit';
import { getApiDetails } from '$lib/server/service/apis/get_api_details';
import { deleteApi } from '$lib/server/service/apis/delete_api';
import type { RequestEvent } from '@sveltejs/kit';
import { apiIdParam, DeleteApiQuery, UpdateApiBody } from '$lib/schemas/apis';
import { updateApi } from '$lib/server/service/apis/update_api';
import { serviceErrorResponse } from '$lib/server/http/service-error';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = apiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid API ID' }, { status: 400 });

  try {
    const result = await getApiDetails({ apiId: parsed.data.id, userId: locals.user.userId });
    return json(result);
  } catch (error) {
    console.error('Error retrieving API:', error);
    if (error instanceof Error) {
      if (error.message === 'API not found') return json({ error: error.message }, { status: 404 });
      if (error.message === 'Unauthorized to access this API')
        return json({ error: error.message }, { status: 403 });
    }
    return json({ error: 'Failed to retrieve API' }, { status: 500 });
  }
}

export async function PATCH({ params, locals, request }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = apiIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid API ID' }, { status: 400 });
  const parsedBody = UpdateApiBody.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const api = await updateApi({
      apiId: parsedParams.data.id,
      userId: locals.user.userId,
      ...parsedBody.data
    });
    return json({ success: true, api });
  } catch (error) {
    const response = serviceErrorResponse(error);
    if (response) return response;
    console.error('Error updating API:', error);
    return json({ error: 'Failed to update API' }, { status: 500 });
  }
}

export async function DELETE({ params, locals, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = apiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid API ID' }, { status: 400 });
  const query = DeleteApiQuery.safeParse({ force: url.searchParams.get('force') ?? 'false' });
  if (!query.success) return json({ error: 'Invalid force value' }, { status: 400 });

  try {
    const result = await deleteApi({
      apiId: parsed.data.id,
      userId: locals.user.userId,
      force: query.data.force
    });
    return json(result);
  } catch (error) {
    const response = serviceErrorResponse(error, {
      affectedFlows: (error as { affectedFlows?: unknown }).affectedFlows
    });
    if (response) return response;
    console.error('Error deleting API:', error);
    return json({ error: 'Failed to delete API' }, { status: 500 });
  }
}
