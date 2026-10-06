import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchEndpointsByDescription } from '$lib/server/service/api_endpoints/search_endpoints';
import { SearchEndpointsQuery } from '$lib/schemas/endpoints';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user || !locals.getUserId) return json({ error: 'Unauthorized' }, { status: 401 });

  const userId = locals.getUserId();
  if (!userId) return json({ error: 'User ID not found' }, { status: 401 });

  const query = url.searchParams.get('query');
  if (!query) return json({ error: 'Query parameter is required' }, { status: 400 });

  const apiIdParam = url.searchParams.get('apiId');
  const apiIdsParams = url.searchParams.getAll('apiIds');
  const limitParam = url.searchParams.get('limit');

  const parsed = SearchEndpointsQuery.safeParse({
    query,
    apiId: apiIdParam || undefined,
    apiIds: apiIdsParams.length ? apiIdsParams : undefined,
    limit: limitParam || undefined
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const results = await searchEndpointsByDescription({
      query: parsed.data.query,
      userId,
      apiId: parsed.data.apiId,
      apiIds: parsed.data.apiIds,
      limit: parsed.data.limit ?? 10
    });

    return json({ success: true, data: results, count: results.length });
  } catch (error) {
    console.error('Error searching endpoints:', error);
    return json({ error: 'Failed to search endpoints' }, { status: 500 });
  }
};
