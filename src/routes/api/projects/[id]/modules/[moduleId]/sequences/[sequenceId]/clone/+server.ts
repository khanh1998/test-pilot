import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../lib/server/service/projects/sequence_service.js';

const sequenceService = new FlowSequenceService();

// POST /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId]/clone - Clone a sequence
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    // Check authentication
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id!);
    const moduleId = parseInt(params.moduleId!);
    const sequenceId = parseInt(params.sequenceId!);

    if (isNaN(projectId) || isNaN(moduleId) || isNaN(sequenceId)) {
      return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return json({ error: 'Sequence name is required' }, { status: 400 });
    }

    if (description !== undefined && typeof description !== 'string') {
      return json({ error: 'Description must be a string' }, { status: 400 });
    }

    // Clone the sequence
    const clonedSequence = await sequenceService.cloneSequence(
      sequenceId,
      moduleId,
      projectId,
      locals.user.userId,
      { name: name.trim(), description: description?.trim() }
    );

    return json({ sequence: clonedSequence }, { status: 201 });
  } catch (error) {
    console.error('Error cloning sequence:', error);
    
    if (error instanceof Error) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};