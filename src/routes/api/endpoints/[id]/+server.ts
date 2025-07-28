import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getApiEndpointById } from '$lib/server/repository/db/api-endpoints';

export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    // Check authentication
    if (!locals.user || !locals.getUserId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = locals.getUserId();
    if (!userId) {
      return json({ error: 'User ID not found' }, { status: 401 });
    }

    // Get endpoint ID from URL parameters
    const endpointId = parseInt(params.id);
    if (isNaN(endpointId)) {
      return json({ error: 'Invalid endpoint ID' }, { status: 400 });
    }

    // Fetch endpoint by ID
    const endpoint = await getApiEndpointById(endpointId, userId);
    
    if (!endpoint) {
      return json({ error: 'Endpoint not found' }, { status: 404 });
    }

    // Return basic endpoint info (excluding heavy schema fields for performance)
    return json({
      success: true,
      data: {
        id: endpoint.id,
        apiId: endpoint.apiId,
        path: endpoint.path,
        method: endpoint.method,
        operationId: endpoint.operationId,
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        createdAt: endpoint.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching endpoint:', error);
    return json(
      { error: 'Failed to fetch endpoint' },
      { status: 500 }
    );
  }
};
