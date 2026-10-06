import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { FlowSequenceService } from '../../../../../../../lib/server/service/projects/sequence_service.js';
import { moduleParams, CreateSequenceRequest } from '$lib/schemas/sequences';

const sequenceService = new FlowSequenceService();

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = moduleParams.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid project or module ID' }, { status: 400 });

  try {
    const sequenceListResponse = await sequenceService.listModuleSequences(
      parsed.data.moduleId,
      parsed.data.id,
      locals.user.userId
    );
    return json(sequenceListResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error listing sequences:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Module or project not found' }, { status: 404 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = moduleParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project or module ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, CreateSequenceRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const sequence = await sequenceService.createSequence(
      parsedParams.data.moduleId,
      parsedParams.data.id,
      locals.user.userId,
      {
        name: parsedBody.data.name.trim(),
        description: parsedBody.data.description || undefined
      }
    );
    return json({ sequence }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error creating sequence:', error);
    if (message.includes('not found') || message.includes('access denied'))
      return json({ error: 'Module or project not found' }, { status: 404 });
    if (message.includes('required') || message.includes('exceed') || message.includes('empty'))
      return json({ error: message }, { status: 400 });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
