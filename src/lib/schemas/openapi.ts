import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

// Import registry first, then all schema modules (order matters — registry must exist before schemas register paths)
import { registry } from './registry';
import './common';
import './agents';
import './auth';
import './users';
import './apis';
import './endpoints';
import './swagger';
import './environments';
import './projects';
import './modules';
import './sequences';
import './test-flows';
import './proxy';

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Test-Pilot API',
      version: '1.0.0',
      description:
        'REST API for Test-Pilot. Authenticate with the JWT returned by sign-in or sign-up. Agent tokens are additionally supported for single test-flow runs. The MCP transport is documented separately in docs/mcp-v1-design.md.'
    },
    servers: [
      {
        url: '/',
        description:
          'Current server; override with your Test-Pilot base URL when importing the spec.'
      }
    ]
  });
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'delete'] as const) {
      const operation = item?.[method];
      if (!operation) continue;
      operation.operationId = `${method}_${path
        .replace(/[{}]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_/, '')}`;
      // All API handlers can fail at validation or service boundaries. Authentication
      // errors may use SvelteKit's { message } envelope rather than { error }.
      for (const status of ['400', '500']) {
        operation.responses[status] ??= {
          description: status === '400' ? 'Invalid request' : 'Internal server error',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } }
          }
        };
      }
      if (operation.security?.length) {
        operation.responses['401'] = {
          description: 'Missing, invalid, or expired bearer token',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } }
          }
        };
      }
      if (operation.requestBody && !('$ref' in operation.requestBody)) {
        operation.requestBody.required = path !== '/api/test-flows/{id}/runs';
      }
    }
  }
  return document;
}
