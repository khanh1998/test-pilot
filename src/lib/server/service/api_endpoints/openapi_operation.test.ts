import { describe, expect, it } from 'vitest';
import {
  parseOpenApiSource,
  putOperation,
  removeOperation,
  serializeOpenApiSource
} from './openapi_operation';

describe('OpenAPI endpoint mutations', () => {
  it('adds an OpenAPI 3 operation with request and response schemas', () => {
    const document = parseOpenApiSource(
      JSON.stringify({ openapi: '3.0.3', info: { title: 'Example', version: '1' }, paths: {} }),
      'json'
    );

    putOperation(document, {
      method: 'POST',
      path: '/users',
      operationId: 'createUser',
      tags: ['users'],
      parameters: [],
      requestSchema: { type: 'object', required: ['name'] },
      responseSchema: { type: 'object', properties: { id: { type: 'integer' } } }
    });

    const operation = document.paths?.['/users'].post as Record<string, unknown>;
    expect(operation.operationId).toBe('createUser');
    expect(operation.requestBody).toEqual({
      required: true,
      content: { 'application/json': { schema: { type: 'object', required: ['name'] } } }
    });
    expect(operation.responses).toEqual({
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { type: 'object', properties: { id: { type: 'integer' } } }
          }
        }
      }
    });
  });

  it('moves an operation while preserving unmodeled OpenAPI fields', () => {
    const document = parseOpenApiSource(
      JSON.stringify({
        openapi: '3.0.3',
        paths: {
          '/users/{id}': {
            get: {
              deprecated: true,
              security: [{ bearer: [] }],
              responses: {
                '200': {
                  description: 'Existing description',
                  headers: { 'x-trace': { schema: { type: 'string' } } },
                  content: {
                    'application/xml': { schema: { type: 'string' } },
                    'application/json': { example: { id: 1 } }
                  }
                },
                '404': { description: 'Not found' }
              }
            }
          }
        }
      }),
      'json'
    );

    putOperation(
      document,
      {
        method: 'PATCH',
        path: '/accounts/{id}',
        parameters: [{ name: 'id', in: 'path' }],
        responseSchema: { type: 'object' }
      },
      { method: 'GET', path: '/users/{id}' }
    );

    expect(document.paths?.['/users/{id}']).toBeUndefined();
    expect(document.paths?.['/accounts/{id}'].patch).toMatchObject({
      deprecated: true,
      security: [{ bearer: [] }],
      responses: {
        '200': {
          description: 'Existing description',
          headers: { 'x-trace': { schema: { type: 'string' } } },
          content: {
            'application/xml': { schema: { type: 'string' } },
            'application/json': { example: { id: 1 }, schema: { type: 'object' } }
          }
        },
        '404': { description: 'Not found' }
      }
    });
  });

  it('round-trips YAML and removes empty paths', () => {
    const document = parseOpenApiSource(
      'openapi: 3.0.3\ninfo:\n  title: Example\n  version: "1"\npaths:\n  /health:\n    get:\n      responses: {}\n',
      'yaml'
    );
    removeOperation(document, '/health', 'GET');
    const reparsed = parseOpenApiSource(serializeOpenApiSource(document, 'yaml'), 'yaml');
    expect(reparsed.paths?.['/health']).toBeUndefined();
  });
});
