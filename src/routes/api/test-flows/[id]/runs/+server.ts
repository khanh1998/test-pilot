import { json, type RequestEvent } from '@sveltejs/kit';
import {
  runTestFlowSync,
  TestFlowRunError,
  type RunTestFlowSyncInput
} from '$lib/server/service/test_flows/run_test_flow_sync';

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const testFlowId = Number(params.id);
  if (!Number.isInteger(testFlowId) || testFlowId <= 0) {
    return json({ error: 'Invalid test flow ID' }, { status: 400 });
  }

  try {
    const body = await readJsonBody(request);
    if (body.mode !== undefined && body.mode !== 'sync') {
      if (body.mode === 'async') {
        return json({ error: 'Async test flow runs are not implemented yet' }, { status: 501 });
      }
      return json({ error: 'Unsupported run mode' }, { status: 400 });
    }

    const result = await runTestFlowSync(testFlowId, locals.user.userId, {
      parameters: isRecord(body.parameters) ? body.parameters : undefined,
      environment: isRecord(body.environment)
        ? {
            environmentId: parseOptionalNumber(body.environment.environmentId),
            subEnvironment:
              typeof body.environment.subEnvironment === 'string'
                ? body.environment.subEnvironment
                : undefined
          }
        : undefined,
      preferences: isRecord(body.preferences)
        ? (body.preferences as RunTestFlowSyncInput['preferences'])
        : undefined
    });

    return json(result, { status: result.status === 'missing_parameters' ? 400 : 200 });
  } catch (error) {
    if (error instanceof TestFlowRunError) {
      return json({ error: error.message }, { status: error.statusCode });
    }

    console.error('Error running test flow:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to run test flow' },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TestFlowRunError('Request body must be valid JSON', 400);
  }

  if (!isRecord(parsed)) {
    throw new TestFlowRunError('Request body must be a JSON object', 400);
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
