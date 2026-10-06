import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEndpointDetails } from '$lib/server/service/api_endpoints/get_endpoint_details';
import { DeleteEndpointQuery, EndpointMutationBody, endpointIdParam } from '$lib/schemas/endpoints';
import {
  deleteManagedEndpoint,
  EndpointManagementError,
  updateManagedEndpoint
} from '$lib/server/service/api_endpoints/manage_endpoint';

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

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const userId = locals.getUserId?.();
  if (!locals.user || !userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = endpointIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid endpoint ID' }, { status: 400 });
  const parsedBody = EndpointMutationBody.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return json({ error: 'Invalid endpoint', details: parsedBody.error.message }, { status: 400 });
  }

  try {
    const endpoint = await updateManagedEndpoint(parsedParams.data.id, parsedBody.data, userId);
    return json({ success: true, data: endpoint });
  } catch (error) {
    return endpointMutationError(error, 'update');
  }
};

export const DELETE: RequestHandler = async ({ locals, params, url }) => {
  const userId = locals.getUserId?.();
  if (!locals.user || !userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = endpointIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid endpoint ID' }, { status: 400 });
  const parsedQuery = DeleteEndpointQuery.safeParse({
    force: url.searchParams.get('force') ?? 'false'
  });
  if (!parsedQuery.success) return json({ error: 'Invalid force value' }, { status: 400 });

  try {
    const result = await deleteManagedEndpoint(
      parsedParams.data.id,
      userId,
      parsedQuery.data.force
    );
    return json({ success: true, data: result });
  } catch (error) {
    return endpointMutationError(error, 'delete');
  }
};

function endpointMutationError(error: unknown, action: 'update' | 'delete') {
  if (error instanceof EndpointManagementError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID' ? 400 : 409;
    return json({ error: error.message, code: error.code }, { status });
  }
  console.error(`Error ${action}ing endpoint:`, error);
  return json({ error: `Failed to ${action} endpoint` }, { status: 500 });
}
