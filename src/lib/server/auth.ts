import { createClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

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
    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw error(401, 'Unauthorized: Invalid token');
    }
    
    // Get user from our database
    const userRecord = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1);
    
    if (!userRecord || userRecord.length === 0) {
      throw error(404, 'User not found in database');
    }
    
    // Return the authenticated user
    return {
      user: userRecord[0],
      supabaseUser: user
    };
  } catch (err: any) {
    console.error('Authentication error:', err);
    
    if (err.status && err.body) {
      throw err; // Re-throw SvelteKit error
    }
    
    throw error(500, 'Authentication error');
  }
}
