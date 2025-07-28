import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { signInUser, type SignInData } from '$lib/server/service/auth/authentication';

export async function POST({ request }: RequestEvent) {
  try {
    // Get user data from request body
    const { email, password } = await request.json();

    if (!email || !password) {
      throw error(400, 'Email and password are required');
    }

    // Validate input
    if (!email.includes('@')) {
      throw error(400, 'Invalid email format');
    }

    const signInData: SignInData = { email, password };
    const result = await signInUser(signInData);

    return json(result);
  } catch (err: unknown) {
    console.error('Error during sign in:', err);

    // Handle known errors
    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      const knownErr = err as { status: number; body: { message: string } };
      throw error(knownErr.status, knownErr.body.message);
    }

    // Handle service layer errors
    if (err instanceof Error) {
      if (err.message.includes('Supabase auth error')) {
        throw error(401, err.message);
      }
    }

    throw error(500, 'An error occurred during sign in');
  }
}
