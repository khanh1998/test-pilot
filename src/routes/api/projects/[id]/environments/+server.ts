import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentService } from '../../../../../lib/server/service/projects/environment_service.js';

const environmentService = new ProjectEnvironmentService();

// GET /api/projects/[id]/environments - List environments linked to project
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

    const environments = await environmentService.listProjectEnvironments(projectId, locals.user.userId);
    
    return json({ environments });
  } catch (error: any) {
    console.error('Error listing project environments:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/environments - Link environment to project
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
    if (!data.environment_id || typeof data.environment_id !== 'number') {
      return json({ error: 'Environment ID is required and must be a number' }, { status: 400 });
    }

    if (data.variableMappings !== undefined && typeof data.variableMappings !== 'object') {
      return json({ error: 'Variable mappings must be an object' }, { status: 400 });
    }

    const link = await environmentService.linkEnvironment(
      projectId, 
      locals.user.userId,
      { 
        environmentId: data.environment_id,
        variableMappings: data.variableMappings || {}
      }
    );

    return json({ link }, { status: 201 });
  } catch (error: any) {
    console.error('Error linking environment:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project or environment not found' }, { status: 404 });
    }
    
    if (error.message.includes('already linked')) {
      return json({ error: 'Environment is already linked to this project' }, { status: 409 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/environments/[environmentId] - Unlink environment from project
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const environmentId = parseInt(params.environmentId as string);
    
    if (isNaN(projectId) || isNaN(environmentId)) {
      return json({ error: 'Invalid project or environment ID' }, { status: 400 });
    }

    await environmentService.unlinkEnvironment(projectId, environmentId, locals.user.userId);

    return json({ message: 'Environment unlinked successfully' });
  } catch (error: any) {
    console.error('Error unlinking environment:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project, environment, or link not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
