import { json } from '@sveltejs/kit';
import { listUserApis } from '$lib/server/service/apis/list_apis';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals, url }: RequestEvent) {
  try {
    // Check if user is authenticated
    if (!locals.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get optional projectId from query parameters
    const projectIdParam = url.searchParams.get('projectId');
    const projectId = projectIdParam ? parseInt(projectIdParam, 10) : undefined;

    const result = await listUserApis({
      userId: locals.user.userId,
      projectId
    });

    return json(result);
  } catch (error) {
    console.error('Error retrieving APIs:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve APIs',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}


