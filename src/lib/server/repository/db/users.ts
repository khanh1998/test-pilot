import { db } from '$lib/server/db/drizzle';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface UserData {
  id: number;
  name: string;
  email: string;
  supabaseAuthId: string | null;
  createdAt: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  supabaseAuthId: string;
}

export interface UserPublicData {
  id: number;
  name: string;
  email: string;
}

/**
 * Find a user by email address
 */
export async function findUserByEmail(email: string): Promise<UserData | null> {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Find a user by their Supabase Auth ID
 */
export async function findUserBySupabaseAuthId(supabaseAuthId: string): Promise<UserData | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.supabaseAuthId, supabaseAuthId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a new user in the database
 */
export async function createUser(userData: CreateUserData): Promise<UserData> {
  const result = await db.insert(users).values(userData).returning();
  return result[0];
}

/**
 * Update user's Supabase Auth ID
 */
export async function updateUserSupabaseAuthId(
  userId: number,
  supabaseAuthId: string
): Promise<UserData> {
  const result = await db
    .update(users)
    .set({ supabaseAuthId })
    .where(eq(users.id, userId))
    .returning();
  return result[0];
}

/**
 * Convert UserData to public user data (excluding sensitive fields)
 */
export function toPublicUserData(user: UserData): UserPublicData {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

/**
 * Find a user by ID
 */
export async function findUserById(id: number): Promise<UserData | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
