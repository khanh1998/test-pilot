import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../lib/server/service/projects/sequence_service.js';

const sequenceService = new FlowSequenceService();

// GET /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId] - Get sequence detail
export async function GET({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    const sequenceId = parseInt(params.sequenceId as string);
    
    if (isNaN(projectId) || isNaN(moduleId) || isNaN(sequenceId)) {
      return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });
    }

    const sequence = await sequenceService.getFlowSequence(sequenceId, moduleId, projectId, locals.user.userId);
    
    return json({ sequence });
  } catch (error: any) {
    console.error('Error getting sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId] - Update sequence
export async function PUT({ params, request, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    const sequenceId = parseInt(params.sequenceId as string);
    
    if (isNaN(projectId) || isNaN(moduleId) || isNaN(sequenceId)) {
      return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });
    }

    const data = await request.json();

    // Validate fields if present
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) {
      return json({ error: 'Sequence name cannot be empty' }, { status: 400 });
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    const sequence = await sequenceService.updateSequence(sequenceId, moduleId, projectId, locals.user.userId, data);

    return json({ sequence });
  } catch (error: any) {
    console.error('Error updating sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    }
    
    if (error.message.includes('required') || error.message.includes('exceed') || error.message.includes('empty')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId] - Delete sequence
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    const sequenceId = parseInt(params.sequenceId as string);
    
    if (isNaN(projectId) || isNaN(moduleId) || isNaN(sequenceId)) {
      return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });
    }

    await sequenceService.deleteSequence(sequenceId, moduleId, projectId, locals.user.userId);

    return json({ message: 'Sequence deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
