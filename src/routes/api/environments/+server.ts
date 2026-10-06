import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createEnvironment } from '$lib/server/service/environments/create_environment';
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
    const environment = await createEnvironment(locals.user.userId, parsed.data);
    return json(environment, { status: 201 });
  } catch (err) {
    console.error('Error creating environment:', err);
    if (
      err instanceof Error &&
      (err.name === 'EnvironmentValidationError' || err.name === 'EnvironmentCreationError')
    ) {
      return json({ error: err.message }, { status: 400 });
    }
    return json({ error: 'Failed to create environment' }, { status: 500 });
  }
}
