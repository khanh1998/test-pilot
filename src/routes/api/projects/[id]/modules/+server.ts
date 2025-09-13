import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectModuleService } from '../../../../../lib/server/service/projects/module_service.js';

const projectModuleService = new ProjectModuleService();

// GET /api/projects/[id]/modules - List modules for a project
export async function GET({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    if (isNaN(projectId)) {
      return json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const modules = await projectModuleService.listProjectModules(projectId, locals.user.userId);
    
    return json({ modules });
  } catch (error: any) {
    console.error('Error listing modules:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/modules - Create new module
export async function POST({ params, request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    if (isNaN(projectId)) {
      return json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      return json({ error: 'Module name is required' }, { status: 400 });
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    const module = await projectModuleService.createModule(projectId, locals.user.userId, {
      name: data.name.trim(),
      description: data.description || null
    });

    return json({ module }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating module:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (error.message.includes('required') || error.message.includes('exceed') || error.message.includes('empty')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
