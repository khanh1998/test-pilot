import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createManagedEnvironment } from '$lib/server/service/environments/manage_environment';
import { serviceErrorResponse } from '$lib/server/http/service-error';
import { getEnvironmentsForUser } from '$lib/server/service/environments/get_environments';
import { CreateEnvironmentRequest } from '$lib/schemas/environments';

export async function GET({ locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const environments = await getEnvironmentsForUser(locals.user.userId);
    return json(environments);
  } catch (err) {
    console.error('Error fetching environments:', err);
    return json({ error: 'Failed to fetch environments' }, { status: 500 });
  }
}

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, CreateEnvironmentRequest);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const environment = await createManagedEnvironment(locals.user.userId, parsed.data);
    return json(environment, { status: 201 });
  } catch (err) {
    const response = serviceErrorResponse(err);
    if (response) return response;
    console.error('Error creating environment:', err);
    return json({ error: 'Failed to create environment' }, { status: 500 });
  }
}
