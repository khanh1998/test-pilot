import { ListProjectsQuery } from '$lib/schemas/projects';
import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectService } from '../../../lib/server/service/projects/project_service.js';
import { CreateProjectRequest } from '$lib/schemas/projects';

const projectService = new ProjectService();

export async function GET({ url, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = ListProjectsQuery.safeParse({
      limit: url.searchParams.get('limit') ?? 50,
      offset: url.searchParams.get('offset') ?? 0
    });
    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { limit, offset } = parsed.data;

    const result = await projectService.listUserProjects(locals.user.userId, limit, offset);
    return json(result);
  } catch (error: unknown) {
    console.error('Error listing projects:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonRequest(request, CreateProjectRequest);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const project = await projectService.createProject(locals.user.userId, {
      name: parsed.data.name,
      description: parsed.data.description,
      apiIds: parsed.data.apiIds || []
    });
    return json({ project }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error creating project:', error);
    if (message.includes('required') || message.includes('exceed')) {
      return json({ error: message }, { status: 400 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
