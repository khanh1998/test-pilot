import { verifyToken } from '$lib/server/auth/auth';
import { error, type Handle } from '@sveltejs/kit';

/**
 * Server hooks for handling requests
 */
export const handle: Handle = async ({ event, resolve }) => {
  const requestPath = event.url.pathname;

  // Skip auth for public routes and auth routes
  const publicRoutes = [
    '/api/auth/sign-in',
    '/api/auth/sign-up',
    // Static assets and client-side routes don't need server authentication
    '/favicon.svg',
    '/_app'
    // Add other public routes as needed
  ];

  // Check if this is a route that needs authentication
  const requiresAuth =
    requestPath.startsWith('/api/') && !publicRoutes.some((route) => requestPath.startsWith(route));

  if (requiresAuth) {
    // Get the Authorization header
    const authHeader = event.request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, 'Unauthorized: Missing or invalid token');
    }

    // Extract the token from the header
    const token = authHeader.split('Bearer ')[1];

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      throw error(401, 'Unauthorized: Invalid or expired token');
    }

    // Ensure we have a valid user object from our verifyToken function
    if (decoded) {
      // Attach the decoded token to the event locals for use in routes
      event.locals.user = decoded;
      event.locals.token = token;

      // Add a helper method to easily get the user ID
      event.locals.getUserId = () => decoded.userId;
    } else {
      throw error(401, 'Unauthorized: Invalid token format');
    }
  }

  // Continue processing the request
  return await resolve(event);
};
