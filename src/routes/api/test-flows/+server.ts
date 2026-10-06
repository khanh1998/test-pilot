import { ListTestFlowsQuery } from '$lib/schemas/test-flows';
import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { deleteTestFlow } from '$lib/server/service/test_flows/delete_test_flow';
import { createBasicTestFlow } from '$lib/server/service/test_flows/create_test_flow';
import { getTestFlowsForUser } from '$lib/server/service/test_flows/list_test_flows';
import { CreateTestFlowRequest, DeleteTestFlowRequest } from '$lib/schemas/test-flows';

export async function GET({ locals, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = ListTestFlowsQuery.safeParse({
      page: url.searchParams.get('page') ?? 1,
      limit: url.searchParams.get('limit') ?? 20,
      search: url.searchParams.get('search') || '',
      projectId: url.searchParams.get('projectId') || undefined
    });

    if (!parsed.success) {
      return json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }

    const result = await getTestFlowsForUser(locals.user.userId, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      search: parsed.data.search.trim() || undefined,
      projectId: parsed.data.projectId
    });

    return json(result);
  } catch (error) {
    console.error('Error fetching test flows:', error);
    return json({ error: 'Failed to fetch test flows' }, { status: 500 });
  }
}

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonRequest(request, CreateTestFlowRequest);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await createBasicTestFlow(locals.user.userId, parsed.data);
    return json(result);
  } catch (error) {
    console.error('Error creating test flow:', error);
    if (error instanceof Error && error.message.includes('APIs not found')) {
      return json({ error: error.message }, { status: 400 });
    }
    return json({ error: 'Failed to create test flow' }, { status: 500 });
  }
}

export async function DELETE({ request, locals }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseJsonRequest(request, DeleteTestFlowRequest);
  if (!parsed.success) {
    return json({ error: 'Test flow ID is required' }, { status: 400 });
  }

  try {
    const deleted = await deleteTestFlow(parsed.data.id, locals.user.userId);
    if (!deleted) {
      return json({ error: 'Test flow not found or does not belong to the user' }, { status: 404 });
    }
    return json({ success: true, id: parsed.data.id });
  } catch (error) {
    console.error('Error deleting test flow:', error);
    return json({ error: 'Failed to delete test flow' }, { status: 500 });
  }
}
