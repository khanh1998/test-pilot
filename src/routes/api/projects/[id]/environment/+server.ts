import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentService } from '../../../../../lib/server/service/projects/environment_service.js';
import { projectIdParam } from '$lib/schemas/projects';

const environmentService = new ProjectEnvironmentService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    const environmentsResponse = await environmentService.listProjectEnvironments(
      parsed.data.id,
      locals.user.userId
    );
    const environment =
      environmentsResponse.environmentLinks.length > 0
        ? environmentsResponse.environmentLinks[0]
        : null;
    return json({ environment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting project environment:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
