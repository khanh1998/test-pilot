import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ProjectEnvironmentService } from '../../../../../lib/server/service/projects/environment_service.js';

const environmentService = new ProjectEnvironmentService();

// GET /api/projects/[id]/environment - Get the single environment linked to project
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

    // Get all environments for the project (should be 0 or 1)
    const environmentsResponse = await environmentService.listProjectEnvironments(projectId, locals.user.userId);
    
    // Return the first environment if it exists, otherwise null
    const environment = environmentsResponse.environmentLinks.length > 0 
      ? environmentsResponse.environmentLinks[0] 
      : null;
    
    return json({ environment });
  } catch (error: any) {
    console.error('Error getting project environment:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}