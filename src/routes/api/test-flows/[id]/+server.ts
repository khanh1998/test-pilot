import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getTestFlow } from '$lib/server/service/test_flows/get_test_flow';
import { updateTestFlow } from '$lib/server/service/test_flows/update_test_flow';
import { testFlowIdParam, UpdateTestFlowRequest } from '$lib/schemas/test-flows';

export async function GET({ params, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = testFlowIdParam.safeParse(params);
  if (!parsed.success) return json({ error: 'Invalid test flow ID' }, { status: 400 });

  try {
    const result = await getTestFlow(parsed.data.id, locals.user.userId);
    if (!result) {
      return json({ error: 'Test flow not found or does not belong to the user' }, { status: 404 });
    }
    return json(result);
  } catch (error) {
    console.error('Error fetching test flow:', error);
    return json({ error: 'Failed to fetch test flow' }, { status: 500 });
  }
}

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = testFlowIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid test flow ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, UpdateTestFlowRequest);
  if (!parsedBody.success) {
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await updateTestFlow(parsedParams.data.id, locals.user.userId, parsedBody.data);
    if (!result) {
      return json({ error: 'Test flow not found or does not belong to the user' }, { status: 404 });
    }
    return json(result);
  } catch (error) {
    console.error('Error updating test flow:', error);
    if (error instanceof Error && error.message.includes('APIs not found')) {
      return json({ error: error.message }, { status: 400 });
    }
    return json({ error: 'Failed to update test flow' }, { status: 500 });
  }
}
