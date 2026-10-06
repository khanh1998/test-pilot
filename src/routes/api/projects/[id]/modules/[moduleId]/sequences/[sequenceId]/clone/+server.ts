import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../../../lib/server/service/projects/sequence_service.js';
import { sequenceParams, CloneSequenceRequest } from '$lib/schemas/sequences';

const sequenceService = new FlowSequenceService();

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = sequenceParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project, module, or sequence ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, CloneSequenceRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const clonedSequence = await sequenceService.cloneSequence(
      parsedParams.data.sequenceId,
      parsedParams.data.moduleId,
      parsedParams.data.id,
      locals.user.userId,
      { name: parsedBody.data.name.trim(), description: parsedBody.data.description?.trim() }
    );
    return json({ sequence: clonedSequence }, { status: 201 });
  } catch (error) {
    console.error('Error cloning sequence:', error);
    if (error instanceof Error) return json({ error: error.message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
