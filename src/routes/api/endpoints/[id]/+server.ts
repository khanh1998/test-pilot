import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEndpointDetails } from '$lib/server/service/api_endpoints/get_endpoint_details';
import { endpointIdParam } from '$lib/schemas/endpoints';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user || !locals.getUserId) return json({ error: 'Unauthorized' }, { status: 401 });

  const userId = locals.getUserId();
  if (!userId) return json({ error: 'User ID not found' }, { status: 401 });

  const parsed = endpointIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid endpoint ID' }, { status: 400 });

  try {
    const endpoint = await getEndpointDetails({ endpointId: parsed.data.id, userId });
    return json({ success: true, data: endpoint });
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    if (error instanceof Error && error.message === 'Endpoint not found or access denied') {
      return json({ error: 'Endpoint not found' }, { status: 404 });
    }
    return json({ error: 'Failed to fetch endpoint' }, { status: 500 });
  }
};
