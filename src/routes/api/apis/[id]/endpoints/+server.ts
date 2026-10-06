import { json } from '@sveltejs/kit';
import { getApiEndpoints } from '$lib/server/service/api_endpoints/list_api_endpoints';
import type { RequestEvent } from '@sveltejs/kit';
import { apiIdParam } from '$lib/schemas/apis';
import { EndpointMutationBody } from '$lib/schemas/endpoints';
import {
  createManagedEndpoint,
  EndpointManagementError
} from '$lib/server/service/api_endpoints/manage_endpoint';

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

export async function POST({ params, locals, request }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = apiIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid API ID' }, { status: 400 });
  const parsedBody = EndpointMutationBody.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return json({ error: 'Invalid endpoint', details: parsedBody.error.message }, { status: 400 });
  }

  try {
    const endpoint = await createManagedEndpoint(
      { apiId: parsedParams.data.id, ...parsedBody.data },
      locals.user.userId
    );
    return json({ success: true, data: endpoint }, { status: 201 });
  } catch (error) {
    if (error instanceof EndpointManagementError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
      return json({ error: error.message }, { status });
    }
    console.error('Error creating endpoint:', error);
    return json({ error: 'Failed to create endpoint' }, { status: 500 });
  }
}
