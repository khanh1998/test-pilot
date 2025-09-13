import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectService } from '../../../lib/server/service/projects/project_service.js';

const projectService = new ProjectService();

// GET /api/projects - List user's projects
export async function GET({ url, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

    const result = await projectService.listUserProjects(locals.user.userId, limit, offset);
    
    return json(result);
  } catch (error: any) {
    console.error('Error listing projects:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST({ request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Basic validation
    if (!data.name || typeof data.name !== 'string') {
      return json({ error: 'Project name is required' }, { status: 400 });
    }

    if (data.description && typeof data.description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    if (data.apiIds && !Array.isArray(data.apiIds)) {
      return json({ error: 'apiIds must be an array' }, { status: 400 });
    }

    const project = await projectService.createProject(locals.user.userId, {
      name: data.name,
      description: data.description,
      apiIds: data.apiIds || []
    });

    return json({ project }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating project:', error);
    
    if (error.message.includes('required') || error.message.includes('exceed')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
