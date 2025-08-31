import { getEnvironment } from '$lib/http_client/environments';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ params }) => {
  // Only run on the client side where localStorage is available
  if (!browser) {
    return {
      environment: null
    };
  }

  const envId = parseInt(params.envId);
  
  if (isNaN(envId)) {
    error(400, 'Invalid environment ID');
  }

  try {
    const environment = await getEnvironment(envId);
    
    if (!environment) {
      error(404, 'Environment not found');
    }

    return {
      environment
    };
  } catch (err) {
    console.error('Error loading environment:', err);
    error(500, 'Failed to load environment');
  }
};
