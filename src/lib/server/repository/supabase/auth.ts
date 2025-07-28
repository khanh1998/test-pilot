import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Create a Supabase admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '', // Use SERVICE KEY, not anon key for server-side
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface SupabaseAuthData {
  user: User;
  session?: any;
}

export interface CreateSupabaseUserData {
  email: string;
  password: string;
  emailConfirm?: boolean;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Create a new user in Supabase Auth
 */
export async function createSupabaseUser(
  userData: CreateSupabaseUserData
): Promise<SupabaseAuthData> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: userData.emailConfirm ?? true // Auto-confirm for simplicity, remove in production
  });

  if (authError) {
    throw new Error(`Supabase auth error: ${authError.message}`);
  }

  return {
    user: authData.user,
    session: null // Admin createUser doesn't return a session
  };
}

/**
 * Sign in a user with Supabase Auth
 */
export async function signInSupabaseUser(credentials: SignInData): Promise<SupabaseAuthData> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password
  });

  if (authError) {
    throw new Error(`Supabase auth error: ${authError.message}`);
  }

  return {
    user: authData.user,
    session: authData.session
  };
}

/**
 * Verify a Supabase token and get user data
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseAuthData> {
  const {
    data: { user },
    error: authError
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    throw new Error(`Invalid Supabase token: ${authError?.message || 'User not found'}`);
  }

  return {
    user,
    session: null // getUser doesn't return session
  };
}
