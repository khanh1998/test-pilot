import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { cloneTestFlow } from '$lib/server/service/test_flows/clone_test_flow';
import { testFlowIdParam, CloneTestFlowRequest } from '$lib/schemas/test-flows';

export async function POST({ request, locals, params }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams = testFlowIdParam.safeParse(params);
  if (!parsedParams.success) return json({ error: 'Invalid test flow ID' }, { status: 400 });

  const parsedBody = await parseJsonRequest(request, CloneTestFlowRequest);
  if (!parsedBody.success)
    return json({ error: parsedBody.error.issues[0].message }, { status: 400 });

  try {
    const result = await cloneTestFlow(parsedParams.data.id, locals.user.userId, {
      name: parsedBody.data.name.trim(),
      description: parsedBody.data.description?.trim()
    });
    return json(result);
  } catch (error) {
    console.error('Error cloning test flow:', error);
    if (error instanceof Error && error.message.includes('not found'))
      return json({ error: error.message }, { status: 404 });
    return json({ error: 'Failed to clone test flow' }, { status: 500 });
  }
}
