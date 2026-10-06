import { ListApisQuery } from '$lib/schemas/apis';
import { json } from '@sveltejs/kit';
import { listUserApis } from '$lib/server/service/apis/list_apis';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals, url }: RequestEvent) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = ListApisQuery.safeParse({
      projectId: url.searchParams.get('projectId') || undefined
    });

    if (!parsed.success) return json({ error: parsed.error.issues[0].message }, { status: 400 });

    const result = await listUserApis({
      userId: locals.user.userId,
      projectId: parsed.data.projectId
    });

    return json(result);
  } catch (error) {
    console.error('Error retrieving APIs:', error);
    return json(
      {
        error: 'Failed to retrieve APIs',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
