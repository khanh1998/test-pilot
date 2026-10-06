import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentMappingService } from '../../../../../../lib/server/service/projects/project_environment_mapping_service.js';
import { UpdateEnvironmentMappingRequest } from '$lib/schemas/projects';
import { z } from 'zod';

const mappingService = new ProjectEnvironmentMappingService();

const projEnvParams = z.object({
  id: z.coerce.number().int().positive(),
  environmentId: z.coerce.number().int().positive()
});

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projEnvParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project or environment ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateEnvironmentMappingRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    await mappingService.updateEnvironmentMapping(
      parsedParams.data.id,
      locals.user.userId,
      parsedParams.data.environmentId,
      parsedBody.data.variableMappings || {}
    );
    return json({ message: 'Environment mapping updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating environment mapping:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project or environment mapping not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projEnvParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project or environment ID' }, { status: 400 });

  try {
    await mappingService.unlinkEnvironment(
      parsedParams.data.id,
      locals.user.userId,
      parsedParams.data.environmentId
    );
    return json({ message: 'Environment unlinked successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error unlinking environment:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project or environment mapping not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
