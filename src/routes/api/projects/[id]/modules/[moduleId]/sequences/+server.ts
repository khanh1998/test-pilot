import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../lib/server/service/projects/sequence_service.js';

const sequenceService = new FlowSequenceService();

// GET /api/projects/[id]/modules/[moduleId]/sequences - List sequences for a module
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

    const sequenceListResponse = await sequenceService.listModuleSequences(moduleId, projectId, locals.user.userId);
    
    return json(sequenceListResponse);
  } catch (error: any) {
    console.error('Error listing sequences:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Module or project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/modules/[moduleId]/sequences - Create new sequence
export async function POST({ params, request, locals }: RequestEvent) {
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

    // Validate required fields
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      return json({ error: 'Sequence name is required' }, { status: 400 });
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    const sequence = await sequenceService.createSequence(moduleId, projectId, locals.user.userId, {
      name: data.name.trim(),
      description: data.description || null
    });

    return json({ sequence }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Module or project not found' }, { status: 404 });
    }
    
    if (error.message.includes('required') || error.message.includes('exceed') || error.message.includes('empty')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
