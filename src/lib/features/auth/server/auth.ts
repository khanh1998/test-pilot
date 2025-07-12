import { createClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

// JWT Secret key - from environment variables
const JWT_SECRET = env.JWT_SECRET || 'test-pilot-secret-key-replace-in-production';
const JWT_EXPIRY = env.JWT_EXPIRY || '24h'; // Token expiry time from env or default to 24 hours

// Create a Supabase admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_KEY || '', // Use SERVICE KEY, not anon key for server-side
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
    // First verify our custom JWT
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      // If our JWT fails, try Supabase token as fallback
      return authenticateWithSupabase(token);
    }

    // Get user from our database
    const userRecord = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

    if (!userRecord || userRecord.length === 0) {
      throw error(404, 'User not found in database');
    }

    // Return the authenticated user
    return {
      user: userRecord[0],
      token
    };
  } catch (err: unknown) {
    console.error('Authentication error:', err);

    if (err instanceof Error && 'status' in err && 'body' in err) {
      throw err; // Re-throw SvelteKit error
    }

    throw error(500, 'Authentication error');
  }
}

/**
 * Fallback authentication with Supabase token
 */
async function authenticateWithSupabase(token: string) {
  // Verify the token with Supabase
  const {
    data: { user },
    error: authError
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    throw error(401, 'Unauthorized: Invalid token');
  }

  // Get user from our database
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.supabaseAuthId, user.id))
    .limit(1);

  if (!userRecord || userRecord.length === 0) {
    throw error(404, 'User not found in database');
  }

  // Return the authenticated user
  return {
    user: userRecord[0],
    supabaseUser: user
  };
}
