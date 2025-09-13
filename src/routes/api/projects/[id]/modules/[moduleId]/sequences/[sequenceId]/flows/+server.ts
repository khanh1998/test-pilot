import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../lib/server/service/projects/sequence_service.js';

const sequenceService = new FlowSequenceService();

// POST /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId]/flows - Add test flow to sequence
export async function POST({ params, request, locals }: RequestEvent) {
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

    // Validate required fields
    if (!data.test_flow_id || typeof data.test_flow_id !== 'number') {
      return json({ error: 'Test flow ID is required and must be a number' }, { status: 400 });
    }

    if (data.step_order !== undefined && typeof data.step_order !== 'number') {
      return json({ error: 'Step order must be a number' }, { status: 400 });
    }

    if (data.parameter_mappings && !Array.isArray(data.parameter_mappings)) {
      return json({ error: 'Parameter mappings must be an array' }, { status: 400 });
    }

    const result = await sequenceService.addFlowToSequence(
      sequenceId, 
      moduleId, 
      projectId, 
      locals.user.userId, 
      {
        test_flow_id: data.test_flow_id,
        step_order: data.step_order || 1,
        parameter_mappings: data.parameter_mappings || []
      }
    );

    return json({ result }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding flow to sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Sequence, module, project, or test flow not found' }, { status: 404 });
    }
    
    if (error.message.includes('required') || error.message.includes('already') || error.message.includes('invalid')) {
      return json({ error: error.message }, { status: 400 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
