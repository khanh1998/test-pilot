import {
  findUserByEmail,
  findUserById,
  findUserBySupabaseAuthId,
  createUser,
  updateUserSupabaseAuthId,
  toPublicUserData,
  type UserData,
  type UserPublicData,
  type CreateUserData
} from '$lib/server/repository/db/user';

/**
 * Get user by email (returns public data only)
 */
export async function getUserByEmail(email: string): Promise<UserPublicData | null> {
  const user = await findUserByEmail(email);
  return user ? toPublicUserData(user) : null;
}

/**
 * Get user by Supabase Auth ID (returns public data only)
 */
export async function getUserBySupabaseAuthId(
  supabaseAuthId: string
): Promise<UserPublicData | null> {
  const user = await findUserBySupabaseAuthId(supabaseAuthId);
  return user ? toPublicUserData(user) : null;
}

/**
 * Get user by ID (returns public data only)
 */
export async function getUserById(id: number): Promise<UserPublicData | null> {
  const user = await findUserById(id);
  return user ? toPublicUserData(user) : null;
}

/**
 * Create a new user and return public data
 */
export async function createNewUser(userData: CreateUserData): Promise<UserPublicData> {
  const user = await createUser(userData);
  return toPublicUserData(user);
}

/**
 * Update user's Supabase Auth ID
 */
export async function linkUserToSupabase(
  userId: number,
  supabaseAuthId: string
): Promise<UserPublicData> {
  const user = await updateUserSupabaseAuthId(userId, supabaseAuthId);
  return toPublicUserData(user);
}

/**
 * Check if user exists by email
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const user = await findUserByEmail(email);
  return user !== null;
}
