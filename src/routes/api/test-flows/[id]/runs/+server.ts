import { json, type RequestEvent } from '@sveltejs/kit';
import {
  runTestFlowSync,
  TestFlowRunError,
  type RunTestFlowSyncInput
} from '$lib/server/service/test_flows/run_test_flow_sync';
import { testFlowIdParam, RunTestFlowRequest } from '$lib/schemas/test-flows';

export async function POST({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = testFlowIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid test flow ID' }, { status: 400 });

  try {
    const body = await readJsonBody(request);
    const parsedBody = RunTestFlowRequest.safeParse(body);
    if (!parsedBody.success)
      return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

    if (parsedBody.data.mode === 'async') {
      return json({ error: 'Async test flow runs are not implemented yet' }, { status: 501 });
    }

    const result = await runTestFlowSync(parsedParams.data.id, locals.user.userId, {
      parameters: parsedBody.data.parameters as Record<string, unknown> | undefined,
      environment: parsedBody.data.environment
        ? {
            environmentId: parsedBody.data.environment.environmentId,
            subEnvironment: parsedBody.data.environment.subEnvironment
          }
        : undefined,
      preferences: parsedBody.data.preferences as RunTestFlowSyncInput['preferences']
    });

    return json(result, { status: result.status === 'missing_parameters' ? 400 : 200 });
  } catch (error) {
    if (error instanceof TestFlowRunError)
      return json({ error: error.message }, { status: error.statusCode });
    console.error('Error running test flow:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to run test flow' },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TestFlowRunError('Request body must be valid JSON', 400);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TestFlowRunError('Request body must be a JSON object', 400);
  }
  return parsed as Record<string, unknown>;
}
