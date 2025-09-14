import { json } from '@sveltejs/kit';
import * as projectService from '$lib/server/service/projects/project_apis';
import type { RequestEvent } from '@sveltejs/kit';

// GET /api/projects/[id]/apis - List APIs linked to project
export async function GET({ params, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id!);
    if (isNaN(projectId)) {
      return json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const result = await projectService.listProjectApis({
      projectId,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error: any) {
    console.error('Error listing project APIs:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/apis - Link API to project
export async function POST({ params, request, locals }: RequestEvent) {
  try {
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id!);
    if (isNaN(projectId)) {
      return json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const { apiId, defaultHost } = body;

    if (!apiId || typeof apiId !== 'number') {
      return json({ error: 'API ID is required' }, { status: 400 });
    }

    const result = await projectService.linkApiToProject({
      projectId,
      apiId,
      defaultHost,
      userId: locals.user.userId
    });

    return json(result);
  } catch (error: any) {
    console.error('Error linking API to project:', error);
    
    if (error.message.includes('already linked')) {
      return json({ error: error.message }, { status: 409 });
    }
    
    if (error.message.includes('not found')) {
      return json({ error: error.message }, { status: 404 });
    }

    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
