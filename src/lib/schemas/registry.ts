import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Use the token returned by sign-in or sign-up. Send Authorization: Bearer <token>.'
});
registry.registerComponent('securitySchemes', 'agentTokenAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Agent token. Accepted by POST /api/test-flows/{id}/runs only on the REST API; other REST endpoints require the sign-in JWT.'
});
