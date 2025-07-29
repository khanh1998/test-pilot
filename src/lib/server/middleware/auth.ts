import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRY } from '$env/static/private';
import { verifyAuthToken, verifySupabaseAuthToken } from '$lib/server/service/auth/authentication';

// JWT Secret key - from environment variables (with fallbacks for static builds)
const jwtSecretKey = JWT_SECRET || 'test-pilot-secret-key-replace-in-production';
const jwtExpiry = JWT_EXPIRY || '24h'; // Token expiry time from env or default to 24 hours

/**
 * Generate a JWT token for a user
 */
export function generateToken(userData: { id: number; email: string; name?: string }): string {
  const payload: JWTPayload = {
    userId: userData.id,
    email: userData.email,
    name: userData.name || ''
  };

  // @ts-expect-error - Working around type issues
  return jwt.sign(payload, jwtSecretKey, { expiresIn: jwtExpiry });
}

/**
 * JWT payload interface
 */
export interface JWTPayload {
  userId: number;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecretKey);
    if (typeof decoded === 'object' && 'userId' in decoded) {
      return decoded as JWTPayload;
    }
    return null;
  } catch (err: unknown) {
    return null;
  }
}

/**
 * Verify authentication token from request
 */
export async function authenticateRequest(event: RequestEvent) {
  // Get the Authorization header
  const authHeader = event.request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw error(401, 'Unauthorized: Missing or invalid token');
  }

  // Extract the token from the header
  const token = authHeader.split('Bearer ')[1];

  try {
    // First try to verify our custom JWT
    const decoded = verifyToken(token);
    if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
      // Use service layer to verify and get user
      const { user } = await verifyAuthToken(token);
      return {
        user,
        token
      };
    }

    // If our JWT fails, try Supabase token as fallback
    const { user, supabaseUser } = await verifySupabaseAuthToken(token);
    return {
      user,
      supabaseUser
    };
  } catch (err: unknown) {
    console.error('Authentication error:', err);

    if (err instanceof Error && 'status' in err && 'body' in err) {
      throw err; // Re-throw SvelteKit error
    }

    // Convert service errors to appropriate HTTP errors
    if (err instanceof Error) {
      if (err.message.includes('Invalid or expired token') || err.message.includes('Invalid Supabase token')) {
        throw error(401, 'Unauthorized: Invalid token');
      }
      if (err.message.includes('User not found')) {
        throw error(404, 'User not found in database');
      }
    }

    throw error(500, 'Authentication error');
  }
}
