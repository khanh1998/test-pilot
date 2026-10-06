import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentMappingService } from '../../../../../lib/server/service/projects/project_environment_mapping_service.js';
import { projectIdParam, LinkEnvironmentMappingRequest } from '$lib/schemas/projects';

const mappingService = new ProjectEnvironmentMappingService();

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, LinkEnvironmentMappingRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    await mappingService.linkEnvironment(
      parsedParams.data.id,
      locals.user.userId,
      parsedBody.data.environmentId,
      parsedBody.data.variableMappings || {}
    );
    return json({ message: 'Environment linked successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error linking environment:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    if (message.includes('already linked')) {
      return json({ error: 'Environment is already linked to this project' }, { status: 409 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
