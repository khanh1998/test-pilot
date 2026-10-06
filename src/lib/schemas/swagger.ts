import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';

export const SwaggerUploadQuery = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  host: z.string().default(''),
  fileName: z.string().default('swagger-spec'),
  projectId: z.coerce.number().int().positive().optional()
});

const SwaggerFile = z
  .custom<File>(
    (value) => value instanceof Blob && 'name' in value && typeof value.name === 'string',
    { message: 'A Swagger/OpenAPI file is required' }
  )
  .openapi({ type: 'string', format: 'binary' });

export const SwaggerUploadForm = SwaggerUploadQuery.omit({ fileName: true }).extend({
  swaggerFile: SwaggerFile
});
export const SwaggerUpdateQuery = z.object({
  fileName: z.string().default('swagger-spec'),
  host: z.string().default('')
});
export const SwaggerUpdateForm = SwaggerUpdateQuery.omit({ fileName: true }).extend({
  swaggerFile: SwaggerFile
});

// ── Response schemas ──────────────────────────────────────────────────────────

const SwaggerUploadResponse = registry.register(
  'SwaggerUploadResponse',
  z.object({
    success: z.literal(true),
    api: z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
      host: z.string().nullable(),
      projectId: z.number().int().nullable(),
      endpointCount: z.number().int()
    })
  })
);

const SwaggerUpdateResponse = registry.register(
  'SwaggerUpdateResponse',
  z.object({
    success: z.literal(true),
    api: z.object({
      id: z.number().int(),
      name: z.string(),
      description: z.string().nullable(),
      host: z.string().nullable(),
      projectId: z.number().int().nullable(),
      endpointCount: z.number().int(),
      updated: z.literal(true),
      addedEndpoints: z.number().int(),
      removedEndpoints: z.number().int()
    })
  })
);

// ── Path param helpers ────────────────────────────────────────────────────────

export const swaggerApiIdParam = z.object({
  id: z.coerce.number().int().positive()
});

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/swagger/upload',
  summary: 'Upload Swagger/OpenAPI spec (multipart form)',
  tags: ['Swagger'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: SwaggerUploadForm
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Uploaded',
      content: { 'application/json': { schema: SwaggerUploadResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/swagger/upload-raw',
  summary: 'Upload Swagger/OpenAPI spec (raw body)',
  tags: ['Swagger'],
  security: [{ bearerAuth: [] }],
  request: {
    query: SwaggerUploadQuery,
    body: {
      content: {
        'application/octet-stream': {
          schema: z.unknown().openapi({ type: 'string', format: 'binary' })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Uploaded',
      content: { 'application/json': { schema: SwaggerUploadResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/swagger/update/{id}',
  summary: 'Update API from Swagger/OpenAPI spec (multipart form)',
  tags: ['Swagger'],
  security: [{ bearerAuth: [] }],
  request: {
    params: swaggerApiIdParam,
    body: {
      content: {
        'multipart/form-data': {
          schema: SwaggerUpdateForm
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SwaggerUpdateResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: {
      description: 'API not found',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/swagger/update-raw/{id}',
  summary: 'Update API from Swagger/OpenAPI spec (raw body)',
  tags: ['Swagger'],
  security: [{ bearerAuth: [] }],
  request: {
    params: swaggerApiIdParam,
    query: SwaggerUpdateQuery,
    body: {
      content: {
        'application/octet-stream': {
          schema: z.unknown().openapi({ type: 'string', format: 'binary' })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SwaggerUpdateResponse } }
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    404: {
      description: 'API not found',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});
