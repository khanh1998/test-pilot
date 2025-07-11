import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { users } from '../../../../db/schema';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { generateToken } from '$lib/features/auth/server/auth';

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
    const { email, password } = await request.json();

    if (!email || !password) {
      throw error(400, 'Email and password are required');
    }

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      throw error(401, authError.message);
    }

    // 2. Retrieve user from our database
    const userRecord = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!userRecord || userRecord.length === 0) {
      // This is unusual - the user exists in Supabase but not in our DB
      // Let's create the user in our database
      const newUser = await db
        .insert(users)
        .values({
          name: email.split('@')[0], // Use part of email as a default name
          email,
          supabaseAuthId: authData.user.id
        })
        .returning();

      // Create a custom JWT token
      const userData = {
        id: newUser[0].id,
        name: newUser[0].name,
        email: newUser[0].email
      };
      const token = generateToken(userData);

      return json({
        message: 'User signed in and synchronized',
        session: authData.session,
        token,
        user: userData
      });
    }

    // Regular sign-in with existing user
    // Create a custom JWT token
    const userData = {
      id: userRecord[0].id,
      name: userRecord[0].name,
      email: userRecord[0].email
    };
    const token = generateToken(userData);

    return json({
      message: 'User signed in successfully',
      session: authData.session,
      token,
      user: userData
    });
  } catch (err: unknown) {
    console.error('Error during sign in:', err);

    // Handle known errors
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      const knownErr = err as { status: number; body: { message: string } };
      throw error(knownErr.status, knownErr.body.message);
    }

    throw error(500, 'An error occurred during sign in');
  }
}
