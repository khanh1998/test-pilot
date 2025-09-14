import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentMappingService } from '../../../../../../lib/server/service/projects/project_environment_mapping_service.js';

const mappingService = new ProjectEnvironmentMappingService();

// PUT /api/projects/[id]/environment-mappings/[environmentId] - Update environment mapping
export async function PUT({ params, request, locals }: RequestEvent) {
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

    const data = await request.json();

    if (data.variableMappings !== undefined && typeof data.variableMappings !== 'object') {
      return json({ error: 'Variable mappings must be an object' }, { status: 400 });
    }

    await mappingService.updateEnvironmentMapping(
      projectId,
      locals.user.userId,
      environmentId,
      data.variableMappings || {}
    );

    return json({ message: 'Environment mapping updated successfully' });
  } catch (error: any) {
    console.error('Error updating environment mapping:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project or environment mapping not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/environment-mappings/[environmentId] - Unlink environment
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

    await mappingService.unlinkEnvironment(projectId, locals.user.userId, environmentId);

    return json({ message: 'Environment unlinked successfully' });
  } catch (error: any) {
    console.error('Error unlinking environment:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project or environment mapping not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
