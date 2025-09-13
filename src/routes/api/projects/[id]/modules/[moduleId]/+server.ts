import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectModuleService } from '../../../../../../lib/server/service/projects/module_service.js';

const projectModuleService = new ProjectModuleService();

// GET /api/projects/[id]/modules/[moduleId] - Get module detail
export async function GET({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    
    if (isNaN(projectId) || isNaN(moduleId)) {
      return json({ error: 'Invalid project or module ID' }, { status: 400 });
    }

    const module = await projectModuleService.getProjectModule(moduleId, projectId, locals.user.userId);
    
    return json({ module });
  } catch (error: any) {
    console.error('Error getting module:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Module or project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/modules/[moduleId] - Update module
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    
    if (isNaN(projectId) || isNaN(moduleId)) {
      return json({ error: 'Invalid project or module ID' }, { status: 400 });
    }

    const data = await request.json();

    // Validate fields if present
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) {
      return json({ error: 'Module name cannot be empty' }, { status: 400 });
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    const module = await projectModuleService.updateModule(moduleId, projectId, locals.user.userId, data);

    return json({ module });
  } catch (error: any) {
    console.error('Error updating module:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Module or project not found' }, { status: 404 });
    }
    
    if (error.message.includes('required') || error.message.includes('exceed') || error.message.includes('empty')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/modules/[moduleId] - Delete module
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    
    if (isNaN(projectId) || isNaN(moduleId)) {
      return json({ error: 'Invalid project or module ID' }, { status: 400 });
    }

    await projectModuleService.deleteModule(moduleId, projectId, locals.user.userId);

    return json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting module:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Module or project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
