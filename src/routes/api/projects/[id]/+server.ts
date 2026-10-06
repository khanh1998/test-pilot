import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectService } from '../../../../lib/server/service/projects/project_service.js';
import { projectIdParam, UpdateProjectRequest } from '$lib/schemas/projects';

const projectService = new ProjectService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    const result = await projectService.getProjectDetail(parsed.data.id, locals.user.userId);
    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting project:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = projectIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateProjectRequest);
  if (!parsedBody.success) {
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });
  }

  try {
    const project = await projectService.updateProject(
      parsedParams.data.id,
      locals.user.userId,
      parsedBody.data
    );
    return json({ project });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating project:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    if (message.includes('required') || message.includes('exceed') || message.includes('empty')) {
      return json({ error: message }, { status: 400 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = projectIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project ID' }, { status: 400 });

  try {
    await projectService.deleteProject(parsed.data.id, locals.user.userId);
    return json({ message: 'Project deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting project:', error);
    if (message.includes('not found') || message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
