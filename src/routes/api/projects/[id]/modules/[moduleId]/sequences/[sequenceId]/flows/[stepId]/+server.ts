import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../../lib/server/service/projects/sequence_service.js';

const sequenceService = new FlowSequenceService();

// DELETE /api/projects/[id]/modules/[moduleId]/sequences/[sequenceId]/flows/[stepId] - Remove test flow from sequence
export async function DELETE({ params, locals }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.id as string);
    const moduleId = parseInt(params.moduleId as string);
    const sequenceId = parseInt(params.sequenceId as string);
    const stepId = params.stepId as string;
    
    if (isNaN(projectId) || isNaN(moduleId) || isNaN(sequenceId) || !stepId) {
      return json({ error: 'Invalid project, module, sequence ID, or step ID' }, { status: 400 });
    }

    await sequenceService.removeFlowFromSequence(
      sequenceId, 
      stepId, 
      moduleId, 
      projectId, 
      locals.user.userId
    );

    return json({ message: 'Flow removed from sequence successfully' });
  } catch (error: any) {
    console.error('Error removing flow from sequence:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return json({ error: 'Sequence, module, project, or step not found' }, { status: 404 });
    }
    
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
