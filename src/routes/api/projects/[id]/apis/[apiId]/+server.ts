import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import * as projectService from '$lib/server/service/projects/project_apis';
import type { RequestEvent } from '@sveltejs/kit';
import { UpdateProjectApiRequest } from '$lib/schemas/projects';
import { z } from 'zod';

const projectApiParams = z.object({
  id: z.coerce.number().int().positive(),
  apiId: z.coerce.number().int().positive()
});

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectApiParams.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project or API ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateProjectApiRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const result = await projectService.updateProjectApi({
      projectId: parsedParams.data.id,
      apiId: parsedParams.data.apiId,
      defaultHost: parsedBody.data.defaultHost,
      userId: locals.user.userId
    });
    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating project API:', error);
    if (message.includes('not found')) return json({ error: message }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectApiParams.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project or API ID' }, { status: 400 });

  try {
    const result = await projectService.unlinkApiFromProject({
      projectId: parsedParams.data.id,
      apiId: parsedParams.data.apiId,
      userId: locals.user.userId
    });
    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error unlinking API from project:', error);
    if (message.includes('not found')) return json({ error: message }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
