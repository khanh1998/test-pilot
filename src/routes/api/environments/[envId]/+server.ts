import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getEnvironmentForUser } from '$lib/server/service/environments/get_environments';
import { updateEnvironment } from '$lib/server/service/environments/update_environment';
import { deleteEnvironment } from '$lib/server/service/environments/delete_environment';
import { envIdParam, UpdateEnvironmentRequest } from '$lib/schemas/environments';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment ID' }, { status: 400 });

  try {
    const environment = await getEnvironmentForUser(parsed.data.envId, locals.user.userId);
    if (!environment) return json({ error: 'Environment not found' }, { status: 404 });
    return json(environment);
  } catch (err) {
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
    const environment = await updateEnvironment(
      parsedParams.data.envId,
      locals.user.userId,
      parsedBody.data
    );
    if (!environment) return json({ error: 'Environment not found' }, { status: 404 });
    return json(environment);
  } catch (err) {
    console.error('Error updating environment:', err);
    if (err instanceof Error && err.name === 'EnvironmentUpdateError') {
      return json({ error: err.message }, { status: 400 });
    }
    return json({ error: 'Failed to update environment' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment ID' }, { status: 400 });

  try {
    await deleteEnvironment(parsed.data.envId, locals.user.userId);
    return json({ success: true, id: parsed.data.envId });
  } catch (err) {
    console.error('Error deleting environment:', err);
    if (err instanceof Error && err.name === 'EnvironmentDeletionError') {
      return json({ error: err.message }, { status: 404 });
    }
    return json({ error: 'Failed to delete environment' }, { status: 500 });
  }
}
