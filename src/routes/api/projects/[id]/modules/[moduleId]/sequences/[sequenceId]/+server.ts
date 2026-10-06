import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../lib/server/service/projects/sequence_service.js';
import { sequenceParams, UpdateSequenceRequest } from '$lib/schemas/sequences';

const sequenceService = new FlowSequenceService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = sequenceParams.safeParse(params);
  if (!parsed.success)
    return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });

  try {
    const sequence = await sequenceService.getFlowSequence(
      parsed.data.sequenceId,
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json({ sequence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = sequenceParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateSequenceRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const sequence = await sequenceService.updateSequence(
      parsedParams.data.sequenceId,
      parsedParams.data.moduleId,
      parsedParams.data.id,
      locals.user.userId,
      parsedBody.data
    );
    return json({ sequence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    if (message.includes('required') || message.includes('exceed') || message.includes('empty'))
      return json({ error: message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = sequenceParams.safeParse(params);
  if (!parsed.success)
    return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });

  try {
    await sequenceService.deleteSequence(
      parsed.data.sequenceId,
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json({ message: 'Sequence deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Sequence, module, or project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
