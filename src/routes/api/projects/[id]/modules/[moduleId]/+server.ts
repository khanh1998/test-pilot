import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectModuleService } from '../../../../../../lib/server/service/projects/module_service.js';
import { projectModuleIdParam, UpdateModuleRequest } from '$lib/schemas/modules';

const projectModuleService = new ProjectModuleService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectModuleIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project or module ID' }, { status: 400 });

  try {
    const module = await projectModuleService.getProjectModule(
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json({ module });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting module:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Module or project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectModuleIdParam.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project or module ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateModuleRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const module = await projectModuleService.updateModule(
      parsedParams.data.moduleId,
      parsedParams.data.id,
      locals.user.userId,
      parsedBody.data
    );
    return json({ module });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating module:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Module or project not found' }, { status: 404 });
    if (message.includes('required') || message.includes('exceed') || message.includes('empty'))
      return json({ error: message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectModuleIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project or module ID' }, { status: 400 });

  try {
    await projectModuleService.deleteModule(
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json({ message: 'Module deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting module:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Module or project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
