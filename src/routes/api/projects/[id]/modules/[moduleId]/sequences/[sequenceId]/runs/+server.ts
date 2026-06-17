import { json, type RequestEvent } from '@sveltejs/kit';
import {
  runSequenceSync,
  SequenceRunError
} from '$lib/server/service/sequences/run_sequence_sync';

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sequenceId = Number(params.sequenceId);
  if (!Number.isInteger(sequenceId) || sequenceId <= 0) {
    return json({ error: 'Invalid sequence ID' }, { status: 400 });
  }

  try {
    const body = await readJsonBody(request);
    const environment = parseEnvironment(body.environment);
    if (!environment) {
      return json(
        { error: 'environment.environmentId and environment.subEnvironment are required' },
        { status: 400 }
      );
    }

    const result = await runSequenceSync(sequenceId, locals.user.userId, {
      environment,
      preferences: isRecord(body.preferences) ? body.preferences : undefined
    });

    return json(result);
  } catch (error) {
    if (error instanceof SequenceRunError) {
      return json({ error: error.message }, { status: error.statusCode });
    }
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
    return isRecord(parsed) ? parsed : {};
  } catch {
    throw new SequenceRunError('Request body must be valid JSON', 400);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEnvironment(
  env: unknown
): { environmentId: number; subEnvironment: string } | null {
  if (!isRecord(env)) return null;
  const environmentId = Number(env.environmentId);
  const subEnvironment = typeof env.subEnvironment === 'string' ? env.subEnvironment : null;
  if (!Number.isFinite(environmentId) || environmentId <= 0 || !subEnvironment) return null;
  return { environmentId, subEnvironment };
}
