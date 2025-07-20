import { apiUrl } from '$lib/api-config';

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  token?: string;
  user?: any;
}

export async function signIn(credentials: SignInRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(apiUrl('/api/auth/sign-in'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sign in failed');
    }

    const data = await response.json();
    return { 
      success: true,
      token: data.token,
      user: data.user
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Authentication failed' };
  }
}

export async function signUp(credentials: SignUpRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(apiUrl('/api/auth/sign-up'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sign up failed');
    }

    const data = await response.json();
    return {
      success: true,
      token: data.token,
      user: data.user
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Registration failed' };
  }
}
