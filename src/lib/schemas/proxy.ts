import { z } from 'zod';
import { registry } from './registry';

// ── Shared schemas ────────────────────────────────────────────────────────────

const Cookie = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.string().optional(),
  maxAge: z.number().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(['strict', 'lax', 'none']).optional()
});

// ── Request / response schemas ────────────────────────────────────────────────

export const ProxyRequest = registry.register(
  'ProxyRequest',
  z.object({
    url: z.string().url(),
    method: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().nullable().optional(),
    cookies: z.array(Cookie).optional()
  })
);

const ProxyResponse = registry.register(
  'ProxyResponse',
  z.object({
    status: z.number().int(),
    statusText: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.unknown(),
    cookies: z.array(Cookie)
  })
);

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/proxy/request',
  summary: 'Proxy an HTTP request to a target API',
  tags: ['Proxy'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: ProxyRequest } } }
  },
  responses: {
    200: {
      description: 'Proxied response',
      content: { 'application/json': { schema: ProxyResponse } }
    },
    400: { description: 'Bad request', content: { 'application/json': { schema: ProxyResponse } } },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ProxyResponse } }
    },
    403: {
      description: 'Blocked by security policy',
      content: { 'application/json': { schema: ProxyResponse } }
    },
    500: { description: 'Proxy error', content: { 'application/json': { schema: ProxyResponse } } },
    502: {
      description: 'Failed to reach target',
      content: { 'application/json': { schema: ProxyResponse } }
    }
  }
});
