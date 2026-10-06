import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectModuleService } from '../../../../../lib/server/service/projects/module_service.js';
import { projectIdParam } from '$lib/schemas/projects';
import { CreateModuleRequest } from '$lib/schemas/modules';

const projectModuleService = new ProjectModuleService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    const moduleListResponse = await projectModuleService.listProjectModules(
      parsed.data.id,
      locals.user.userId
    );
    return json(moduleListResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error listing modules:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, CreateModuleRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const module = await projectModuleService.createModule(
      parsedParams.data.id,
      locals.user.userId,
      {
        name: parsedBody.data.name.trim(),
        description: parsedBody.data.description || undefined
      }
    );
    return json({ module }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error creating module:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Project not found' }, { status: 404 });
    if (message.includes('required') || message.includes('exceed') || message.includes('empty'))
      return json({ error: message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
