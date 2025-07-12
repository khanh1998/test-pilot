import { db } from '$lib/server/db/drizzle';
import { users } from '$lib/server/db/schema';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
  // We can access the authenticated user from event.locals
  const authenticatedUser = event.locals.user;
  try {
    const allUsers = await db.select().from(users).limit(10);
    return json({
      users: allUsers,
      currentUser: authenticatedUser
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    throw error(500, 'Failed to fetch users');
  }
}
