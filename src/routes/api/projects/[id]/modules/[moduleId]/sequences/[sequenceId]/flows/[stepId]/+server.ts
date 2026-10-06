import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../../lib/server/service/projects/sequence_service.js';
import { flowStepParams } from '$lib/schemas/sequences';

const sequenceService = new FlowSequenceService();

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = flowStepParams.safeParse(params);
  if (!parsed.success)
    return json({ error: 'Invalid project, module, sequence ID, or step ID' }, { status: 400 });

  try {
    await sequenceService.removeFlowFromSequence(
      parsed.data.sequenceId,
      parsed.data.stepId,
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json({ message: 'Flow removed from sequence successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error removing flow from sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: message }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
