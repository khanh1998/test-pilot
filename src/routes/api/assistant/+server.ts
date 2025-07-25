import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSkeletonTestFlowService } from '$lib/server/service/assistant/skeleton';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Ensure user is authenticated
    if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body to get the description
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string') {
      return json({ error: 'Description is required and must be a string' }, { status: 400 });
    }

    // Get the user ID
    const userId = locals.getUserId ? locals.getUserId() : undefined;

    // Generate skeleton test flow with endpoint enrichment
    const skeletonTestFlow = await generateSkeletonTestFlowService(description, userId ? Number(userId) : undefined);
    
    return json({ skeletonTestFlow });
  } catch (error) {
    console.error('Error in skeleton test flow generation endpoint:', error);
    return json({ error: 'Failed to generate skeleton test flow' }, { status: 500 });
  }
};
