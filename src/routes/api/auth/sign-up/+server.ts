import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { users } from '../../../../db/schema';
import { createClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { generateToken } from '$lib/server/auth';

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

export async function POST({ request }: RequestEvent) {
  try {
    // Get user data from request body
    const { email, password, name } = await request.json();
    
    if (!email || !password || !name) {
      throw error(400, 'Email, password, and name are required');
    }

    // 1. Register user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm for simplicity, remove in production
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      throw error(400, authError.message);
    }

    // 2. Add user to our database with reference to Supabase auth ID
    const newUser = await db.insert(users).values({
      name,
      email,
      supabaseAuthId: authData.user.id
    }).returning();

    // Create user data object
    const userData = {
      id: newUser[0].id,
      name: newUser[0].name,
      email: newUser[0].email
    };
    
    // Generate JWT token
    const token = generateToken(userData);

    return json({ 
      message: 'User registered successfully',
      user: userData,
      token,
      session: authData.user // Include Supabase session for compatibility
    });
    
  } catch (err: unknown) {
    console.error('Error during sign up:', err);
    
    // Handle known errors
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      const knownErr = err as { status: number; body: { message: string } };
      throw error(knownErr.status, knownErr.body.message);
    }
    
    throw error(500, 'An error occurred during registration');
  }
}
