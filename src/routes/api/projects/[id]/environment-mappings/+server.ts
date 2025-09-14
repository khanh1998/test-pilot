import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentMappingService } from '../../../../../lib/server/service/projects/project_environment_mapping_service.js';

const mappingService = new ProjectEnvironmentMappingService();

// POST /api/projects/[id]/environment-mappings - Link environment to project using project_json
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
    if (!data.environmentId || typeof data.environmentId !== 'number') {
      return json({ error: 'Environment ID is required and must be a number' }, { status: 400 });
    }

    if (data.variableMappings !== undefined && typeof data.variableMappings !== 'object') {
      return json({ error: 'Variable mappings must be an object' }, { status: 400 });
    }

    await mappingService.linkEnvironment(
      projectId,
      locals.user.userId,
      data.environmentId,
      data.variableMappings || {}
    );

    return json({ message: 'Environment linked successfully' }, { status: 201 });
  } catch (error: any) {
    console.error('Error linking environment:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (error.message.includes('already linked')) {
      return json({ error: 'Environment is already linked to this project' }, { status: 409 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
