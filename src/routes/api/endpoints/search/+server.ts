import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchEndpointsByDescription } from '$lib/server/service/api_endpoints/search_endpoints';

export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    // Check authentication
    if (!locals.user || !locals.getUserId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = locals.getUserId();
    if (!userId) {
      return json({ error: 'User ID not found' }, { status: 401 });
    }

    // Get query parameters
    const query = url.searchParams.get('query');
    const apiIdParam = url.searchParams.get('apiId');
    const limitParam = url.searchParams.get('limit');
    
    if (!query) {
      return json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Parse optional apiId
    let apiId: number | undefined;
    if (apiIdParam) {
      const parsedApiId = parseInt(apiIdParam, 10);
      if (isNaN(parsedApiId)) {
        return json({ error: 'Invalid apiId parameter' }, { status: 400 });
      }
      apiId = parsedApiId;
    }

    // Parse limit
    let limit: number;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit)) {
        return json({ error: 'Invalid limit parameter' }, { status: 400 });
      }
      limit = parsedLimit;
    } else {
        limit = 10;
    }

    // Search endpoints
    const results = await searchEndpointsByDescription({
      query,
      userId,
      apiId,
      limit,
    });

    return json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Error searching endpoints:', error);
    return json(
      { error: 'Failed to search endpoints' },
      { status: 500 }
    );
  }
};
