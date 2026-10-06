import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../lib/server/service/projects/sequence_service.js';
import { sequenceParams, AddFlowToSequenceRequest } from '$lib/schemas/sequences';

const sequenceService = new FlowSequenceService();

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = sequenceParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, AddFlowToSequenceRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const result = await sequenceService.addFlowToSequence(
      parsedParams.data.sequenceId,
      parsedParams.data.moduleId,
      parsedParams.data.id,
      locals.user.userId,
      {
        test_flow_id: parsedBody.data.test_flow_id,
        step_order: parsedBody.data.step_order || 1,
        parameter_mappings: parsedBody.data.parameter_mappings || []
      }
    );
    return json({ result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error adding flow to sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: message }, { status: 404 });
    if (message.includes('required') || message.includes('already') || message.includes('invalid'))
      return json({ error: message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
