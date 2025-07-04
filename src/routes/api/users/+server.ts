import { db } from '$lib/server/drizzle';
import { users } from '../../../db/schema';
import { error, json } from '@sveltejs/kit';

export async function GET() {
  try {
    const allUsers = await db.select().from(users).limit(10);
    return json(allUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    throw error(500, 'Failed to fetch users');
  }
}
