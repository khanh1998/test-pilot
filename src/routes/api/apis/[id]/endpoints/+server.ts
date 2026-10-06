import { json } from '@sveltejs/kit';
import { getApiEndpoints } from '$lib/server/service/api_endpoints/list_api_endpoints';
import type { RequestEvent } from '@sveltejs/kit';
import { apiIdParam } from '$lib/schemas/apis';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = apiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid API ID' }, { status: 400 });

  try {
    const result = await getApiEndpoints({ apiId: parsed.data.id, userId: locals.user.userId });
    return json(result);
  } catch (error) {
    console.error('Error retrieving API endpoints:', error);
    if (error instanceof Error && error.message === 'API not found or access denied') {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Failed to retrieve API endpoints' }, { status: 500 });
  }
}
