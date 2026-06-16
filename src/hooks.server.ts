import { verifyToken } from '$lib/server/middleware/auth';
import { AgentTokenService } from '$lib/server/service/agents/agent_token_service';
import { error, type Handle } from '@sveltejs/kit';

const agentTokenService = new AgentTokenService();

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
    '/favicon.ico',
    '/_app'
    // Add other public routes as needed
  ];

  // Check if this is a route that needs authentication
  const requiresAuth =
    requestPath.startsWith('/api/') && !publicRoutes.some((route) => requestPath.startsWith(route));
  const allowsAgentToken =
    event.request.method === 'POST' && /^\/api\/test-flows\/\d+\/runs$/.test(requestPath);

  if (requiresAuth) {
    // Get the Authorization header
    const authHeader = event.request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw error(401, 'Unauthorized: Missing or invalid token');
    }

    // Extract the token from the header
    const token = authHeader.split('Bearer ')[1];

    const decoded = verifyToken(token);
    if (!decoded) {
      if (!allowsAgentToken) {
        throw error(401, 'Unauthorized: Invalid or expired token');
      }

      try {
        const agentAuth = await agentTokenService.authenticateToken(token);
        event.locals.user = {
          userId: agentAuth.userId,
          email: agentAuth.email,
          name: agentAuth.name || ''
        };
        event.locals.token = token;
        event.locals.authSource = 'agent_token';
        event.locals.agentTokenId = agentAuth.tokenId;
        event.locals.getUserId = () => agentAuth.userId;
      } catch {
        throw error(401, 'Unauthorized: Invalid or expired token');
      }
    } else {
      event.locals.user = decoded;
      event.locals.token = token;
      event.locals.authSource = 'jwt';
      event.locals.getUserId = () => decoded.userId;
    }
  }

  // Continue processing the request
  return await resolve(event);
};
