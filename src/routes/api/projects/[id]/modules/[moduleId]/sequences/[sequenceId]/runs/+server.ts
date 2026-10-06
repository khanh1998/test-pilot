import { json, type RequestEvent } from '@sveltejs/kit';
import { runSequenceSync, SequenceRunError } from '$lib/server/service/sequences/run_sequence_sync';
import { RunSequenceRequest } from '$lib/schemas/sequences';
import { z } from 'zod';

const runSequenceParams = z.object({
  sequenceId: z.coerce.number().int().positive()
});

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = runSequenceParams.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid sequence ID' }, { status: 400 });

  try {
    const body = await readJsonBody(request);
    const parsedBody = RunSequenceRequest.safeParse(body);
    if (!parsedBody.success) {
      return json({ error: parsedBody.error.issues[0].message }, { status: 400 });
    }

    const result = await runSequenceSync(parsedParams.data.sequenceId, locals.user.userId, {
      environment: parsedBody.data.environment,
      preferences: parsedBody.data.preferences as Record<string, unknown> | undefined
    });

    return json(result);
  } catch (error) {
    if (error instanceof SequenceRunError)
      return json({ error: error.message }, { status: error.statusCode });
    console.error('Error running sequence:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to run sequence' },
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
