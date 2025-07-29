import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEndpointDetails } from '$lib/server/service/api_endpoints/get_endpoint_details';

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

    // Fetch endpoint details via service layer (including schemas and parameters)
    const endpoint = await getEndpointDetails({
      endpointId,
      userId
    });

    // Return full endpoint details
    return json({
      success: true,
      data: endpoint
    });

  } catch (error) {
    console.error('Error fetching endpoint:', error);
    
    // Handle specific service errors
    if (error instanceof Error && error.message === 'Endpoint not found or access denied') {
      return json({ error: 'Endpoint not found' }, { status: 404 });
    }
    
    return json(
      { error: 'Failed to fetch endpoint' },
      { status: 500 }
    );
  }
};
