import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import * as projectService from '$lib/server/service/projects/project_apis';
import type { RequestEvent } from '@sveltejs/kit';
import { projectIdParam, LinkApiToProjectRequest } from '$lib/schemas/projects';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    const result = await projectService.listProjectApis({
      projectId: parsed.data.id,
      userId: locals.user.userId
    });
    return json(result);
  } catch (error: unknown) {
    console.error('Error listing project APIs:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, LinkApiToProjectRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const result = await projectService.linkApiToProject({
      projectId: parsedParams.data.id,
      apiId: parsedBody.data.apiId,
      defaultHost: parsedBody.data.defaultHost,
      userId: locals.user.userId
    });
    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error linking API to project:', error);
    if (message.includes('already linked')) return json({ error: message }, { status: 409 });
    if (message.includes('not found')) return json({ error: message }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
