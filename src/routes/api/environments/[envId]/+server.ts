import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import {
  deleteManagedEnvironment,
  getManagedEnvironment,
  updateManagedEnvironment
} from '$lib/server/service/environments/manage_environment';
import { serviceErrorResponse } from '$lib/server/http/service-error';
import {
  DeleteEnvironmentQuery,
  envIdParam,
  UpdateEnvironmentRequest
} from '$lib/schemas/environments';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment ID' }, { status: 400 });

  try {
    return json(await getManagedEnvironment(parsed.data.envId, locals.user.userId));
  } catch (err) {
    const response = serviceErrorResponse(err);
    if (response) return response;
    console.error('Error fetching environment:', err);
    return json({ error: 'Failed to fetch environment' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsedParams = envIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid environment ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateEnvironmentRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const environment = await updateManagedEnvironment(
      parsedParams.data.envId,
      locals.user.userId,
      parsedBody.data
    );
    return json(environment);
  } catch (err) {
    const response = serviceErrorResponse(err);
    if (response) return response;
    console.error('Error updating environment:', err);
    return json({ error: 'Failed to update environment' }, { status: 500 });
  }
}

export async function DELETE({ params, locals, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment ID' }, { status: 400 });

  const query = DeleteEnvironmentQuery.safeParse({ force: url.searchParams.get('force') ?? 'false' });
  if (!query.success) return json({ error: 'Invalid force value' }, { status: 400 });

  try {
    const result = await deleteManagedEnvironment(
      parsed.data.envId,
      locals.user.userId,
      query.data.force
    );
    return json({ success: true, id: parsed.data.envId, ...result });
  } catch (err) {
    const response = serviceErrorResponse(err, {
      forceable: (err as { forceable?: unknown }).forceable
    });
    if (response) return response;
    console.error('Error deleting environment:', err);
    return json({ error: 'Failed to delete environment' }, { status: 500 });
  }
}
