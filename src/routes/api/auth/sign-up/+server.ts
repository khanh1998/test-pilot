import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { signUpUser, type SignUpData } from '$lib/server/service/auth/authentication';

export async function POST({ request }: RequestEvent) {
  try {
    // Get user data from request body
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      throw error(400, 'Email, password, and name are required');
    }

    // Validate input
    if (!email.includes('@')) {
      throw error(400, 'Invalid email format');
    }

    if (password.length < 6) {
      throw error(400, 'Password must be at least 6 characters long');
    }

    const signUpData: SignUpData = { name, email, password };
    const result = await signUpUser(signUpData);

    return json(result);
  } catch (err: unknown) {
    console.error('Error during sign up:', err);

    // Handle known errors
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      const knownErr = err as { status: number; body: { message: string } };
      throw error(knownErr.status, knownErr.body.message);
    }

    // Handle service layer errors
    if (err instanceof Error) {
      if (err.message.includes('User with this email already exists')) {
        throw error(409, err.message);
      }
      if (err.message.includes('Supabase auth error')) {
        throw error(400, err.message);
      }
    }

    throw error(500, 'An error occurred during registration');
  }
}
