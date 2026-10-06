import { parseJsonRequest } from '$lib/server/http/parse-json-request';
import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { signUpUser } from '$lib/server/service/auth/authentication';
import { SignUpRequest } from '$lib/schemas/auth';

export async function POST({ request }: RequestEvent) {
  try {
    const parsed = await parseJsonRequest(request, SignUpRequest);
    if (!parsed.success) {
      throw error(400, parsed.error.issues[0].message);
    }

    const result = await signUpUser(parsed.data);
    return json(result);
  } catch (err: unknown) {
    console.error('Error during sign up:', err);

    if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
      const knownErr = err as { status: number; body: { message: string } };
      throw error(knownErr.status, knownErr.body.message);
    }

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
