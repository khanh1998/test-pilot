import { json } from '@sveltejs/kit';
import * as projectService from '$lib/server/service/projects/project_apis';
import type { RequestEvent } from '@sveltejs/kit';

// PUT /api/projects/[id]/apis/[apiId] - Update API settings in project
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id!);
    const apiId = parseInt(params.apiId!);
    
    if (isNaN(projectId) || isNaN(apiId)) {
      return json({ error: 'Invalid project or API ID' }, { status: 400 });
    }

    const body = await request.json();
    const { defaultHost } = body;

    const result = await projectService.updateProjectApi({
      projectId,
      apiId,
      defaultHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error: any) {
    console.error('Error updating project API:', error);
    
    if (error.message.includes('not found')) {
      return json({ error: error.message }, { status: 404 });
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/apis/[apiId] - Unlink API from project
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id!);
    const apiId = parseInt(params.apiId!);
    
    if (isNaN(projectId) || isNaN(apiId)) {
      return json({ error: 'Invalid project or API ID' }, { status: 400 });
    }

    const result = await projectService.unlinkApiFromProject({
      projectId,
      apiId,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error: any) {
    console.error('Error unlinking API from project:', error);
    
    if (error.message.includes('not found')) {
      return json({ error: error.message }, { status: 404 });
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
