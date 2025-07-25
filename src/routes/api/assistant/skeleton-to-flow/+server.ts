import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateTestFlowFromSkeleton } from '$lib/server/service/assistant/skeleton-to-flow';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Ensure user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body to get the skeleton test flow
    const body = await request.json();
    const { skeleton } = body;

    if (!skeleton || typeof skeleton !== 'object') {
      return json({ error: 'Skeleton test flow is required and must be an object' }, { status: 400 });
    }

    // Get the user ID
    const userId = locals.getUserId ? locals.getUserId() : undefined;

    // Generate complete test flow from skeleton
    const testFlow = await generateTestFlowFromSkeleton(skeleton, userId ? Number(userId) : undefined);
    
    return json({ testFlow });
  } catch (error) {
    console.error('Error in skeleton to flow generation endpoint:', error);
    return json({ error: 'Failed to generate test flow from skeleton' }, { status: 500 });
  }
};
