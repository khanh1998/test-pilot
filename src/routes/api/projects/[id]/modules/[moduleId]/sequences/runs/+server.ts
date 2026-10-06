import { json, type RequestEvent } from '@sveltejs/kit';
import {
  runSequencesByIds,
  runSequencesByModuleId,
  type RunSequencesSyncInput
} from '$lib/server/service/sequences/run_sequences_sync';
import { SequenceRunError } from '$lib/server/service/sequences/run_sequence_sync';
import { RunSequencesBatchRequest, moduleParams } from '$lib/schemas/sequences';

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = moduleParams.safeParse(params);
  if (!parsedParams.success)
    return json({ error: 'Invalid project or module ID' }, { status: 400 });

  try {
    const body = await readJsonBody(request);
    const parsedBody = RunSequencesBatchRequest.safeParse(body);
    if (!parsedBody.success) {
      return json({ error: parsedBody.error.issues[0].message }, { status: 400 });
    }

    const runInput: RunSequencesSyncInput = {
      environment: parsedBody.data.environment,
      preferences: parsedBody.data.preferences as Record<string, unknown> | undefined,
      mode: parsedBody.data.mode ?? 'sequential'
    };

    const sequenceIds = parsedBody.data.sequenceIds ?? [];

    const result =
      sequenceIds.length > 0
        ? await runSequencesByIds(sequenceIds, locals.user.userId, runInput)
        : await runSequencesByModuleId(
            parsedParams.data.moduleId,
            parsedParams.data.id,
            locals.user.userId,
            runInput
          );

    return json(result);
  } catch (error) {
    if (error instanceof SequenceRunError)
      return json({ error: error.message }, { status: error.statusCode });
    console.error('Error running sequences:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to run sequences' },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new SequenceRunError('Request body must be valid JSON', 400);
  }
}
