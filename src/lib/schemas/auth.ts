import { z } from 'zod';
import { registry } from './registry';
import { ErrorResponse } from './common';

// ── Shared schemas ────────────────────────────────────────────────────────────

export const UserPublic = registry.register(
  'UserPublic',
  z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string().email()
  })
);

export const AuthResponse = registry.register(
  'AuthResponse',
  z.object({
    message: z.string(),
    user: UserPublic,
    token: z.string(),
    session: z.unknown().optional()
  })
);

// ── Request schemas ───────────────────────────────────────────────────────────

export const SignInRequest = registry.register(
  'SignInRequest',
  z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
);

export const SignUpRequest = registry.register(
  'SignUpRequest',
  z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6)
  })
);

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/auth/sign-in',
  summary: 'Sign in with email and password',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: SignInRequest } } }
  },
  responses: {
    200: {
      description: 'Authenticated',
      content: { 'application/json': { schema: AuthResponse } }
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/sign-up',
  summary: 'Register a new account',
  tags: ['Auth'],
  request: {
    body: { content: { 'application/json': { schema: SignUpRequest } } }
  },
  responses: {
    200: { description: 'Registered', content: { 'application/json': { schema: AuthResponse } } },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponse } }
    },
    409: {
      description: 'Email already exists',
      content: { 'application/json': { schema: ErrorResponse } }
    }
  }
});
