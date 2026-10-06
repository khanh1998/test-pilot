import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import {
  linkApiToEnvironmentService,
  unlinkApiFromEnvironmentService
} from '$lib/server/service/environments/link_api';
import { envApiIdParam } from '$lib/schemas/environments';

export async function POST({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envApiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment or API ID' }, { status: 400 });

  try {
    await linkApiToEnvironmentService(parsed.data.envId, parsed.data.apiId);
    return json({ success: true, environmentId: parsed.data.envId, apiId: parsed.data.apiId });
  } catch (err) {
    console.error('Error linking API to environment:', err);
    if (err instanceof Error && err.name === 'ApiLinkingError') {
      const statusCode = err.message.includes('already linked') ? 409 : 400;
      return json({ error: err.message }, { status: statusCode });
    }
    return json({ error: 'Failed to link API to environment' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Authentication required' }, { status: 401 });

  const parsed = envApiIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid environment or API ID' }, { status: 400 });

  try {
    await unlinkApiFromEnvironmentService(parsed.data.envId, parsed.data.apiId);
    return json({ success: true, environmentId: parsed.data.envId, apiId: parsed.data.apiId });
  } catch (err) {
    console.error('Error unlinking API from environment:', err);
    if (err instanceof Error && err.name === 'ApiLinkingError') {
      return json({ error: err.message }, { status: 404 });
    }
    return json({ error: 'Failed to unlink API from environment' }, { status: 500 });
  }
}
