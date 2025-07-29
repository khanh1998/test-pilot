import { generateToken, verifyToken, type JWTPayload } from '$lib/server/middleware/auth';
import {
  findUserByEmail,
  findUserById,
  findUserBySupabaseAuthId,
  createUser,
  toPublicUserData,
  type UserData,
  type UserPublicData,
  type CreateUserData
} from '$lib/server/repository/db/users';
import {
  createSupabaseUser,
  signInSupabaseUser,
  verifySupabaseToken,
  type CreateSupabaseUserData,
  type SignInData as SupabaseSignInData
} from '$lib/server/repository/supabase/auth';

export interface SignUpData {
  name: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: UserPublicData;
  token: string;
  session?: any;
}

/**
 * Sign up a new user
 */
export async function signUpUser(signUpData: SignUpData): Promise<AuthResponse> {
  const { name, email, password } = signUpData;

  // Check if user already exists
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // 1. Create user in Supabase Auth
  const supabaseAuthData = await createSupabaseUser({
    email,
    password,
    emailConfirm: true
  });

  // 2. Create user in our local database
  const createUserData: CreateUserData = {
    name,
    email,
    supabaseAuthId: supabaseAuthData.user.id
  };

  const newUser = await createUser(createUserData);

  // 3. Generate JWT token
  const userData = toPublicUserData(newUser);
  const token = generateToken(userData);

  return {
    message: 'User registered successfully',
    user: userData,
    token,
    session: supabaseAuthData.user
  };
}

/**
 * Sign in an existing user
 */
export async function signInUser(signInData: SignInData): Promise<AuthResponse> {
  const { email, password } = signInData;

  // 1. Authenticate with Supabase Auth
  const supabaseAuthData = await signInSupabaseUser({ email, password });

  // 2. Get user from our local database
  let user = await findUserByEmail(email);

  if (!user) {
    // User exists in Supabase but not in our DB - sync them
    const createUserData: CreateUserData = {
      name: email.split('@')[0], // Use part of email as default name
      email,
      supabaseAuthId: supabaseAuthData.user.id
    };

    user = await createUser(createUserData);

    const userData = toPublicUserData(user);
    const token = generateToken(userData);

    return {
      message: 'User signed in and synchronized',
      user: userData,
      token,
      session: supabaseAuthData.session
    };
  }

  // 3. Generate JWT token for existing user
  const userData = toPublicUserData(user);
  const token = generateToken(userData);

  return {
    message: 'User signed in successfully',
    user: userData,
    token,
    session: supabaseAuthData.session
  };
}

/**
 * Verify a JWT token and return user data
 */
export async function verifyAuthToken(token: string): Promise<{
  user: UserData;
  payload: JWTPayload;
}> {
  // Verify the JWT token
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    throw new Error('Invalid or expired token');
  }

  // Get user from database
  const user = await findUserById(payload.userId);
  if (!user) {
    throw new Error('User not found');
  }

  return { user, payload };
}

/**
 * Verify a Supabase token and return user data
 */
export async function verifySupabaseAuthToken(token: string): Promise<{
  user: UserData;
  supabaseUser: any;
}> {
  // Verify Supabase token
  const supabaseAuthData = await verifySupabaseToken(token);

  // Get user from our database using Supabase auth ID
  const user = await findUserBySupabaseAuthId(supabaseAuthData.user.id);
  if (!user) {
    throw new Error('User not found in local database');
  }

  return {
    user,
    supabaseUser: supabaseAuthData.user
  };
}
