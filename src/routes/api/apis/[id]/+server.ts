import { json } from '@sveltejs/kit';
import { getApiDetails } from '$lib/server/service/apis/get_api_details';
import { deleteApi } from '$lib/server/service/apis/delete_api';
import type { RequestEvent } from '@sveltejs/kit';
import { apiIdParam } from '$lib/schemas/apis';

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

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = apiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid API ID' }, { status: 400 });

  try {
    const result = await deleteApi({ apiId: parsed.data.id, userId: locals.user.userId });
    return json(result);
  } catch (error) {
    console.error('Error deleting API:', error);
    if (error instanceof Error) {
      if (error.message === 'API not found') return json({ error: error.message }, { status: 404 });
      if (error.message === 'Unauthorized to delete this API')
        return json({ error: error.message }, { status: 403 });
    }
    return json({ error: 'Failed to delete API' }, { status: 500 });
  }
}
