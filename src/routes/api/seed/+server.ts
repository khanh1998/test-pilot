import { db } from '$lib/server/drizzle';
import { users } from '../../../db/schema';
import { json } from '@sveltejs/kit';

export async function POST() {
  try {
    // Sample data for users
    const usersData = [
      { name: 'Alice Johnson', email: 'alice_test@example.com' },
      { name: 'Bob Smith', email: 'bob_test@example.com' },
      { name: 'Carol Williams', email: 'carol_test@example.com' }
    ];

    // Create users - checking if they already exist
    const createdUsers = [];
    for (const userData of usersData) {
      try {
        const [createdUser] = await db
          .insert(users)
          .values(userData)
          .returning()
          .onConflictDoNothing({ target: users.email });

        if (createdUser) {
          createdUsers.push(createdUser);
        }
      } catch (err) {
        console.error(`Error creating user ${userData.email}:`, err);
      }
    }

    // Return the created data
    return json({
      success: true,
      users: createdUsers
    });
  } catch (err) {
    console.error('Error seeding data:', err);
    return json(
      {
        success: false,
        error: 'Failed to create sample data'
      },
      { status: 500 }
    );
  }
}
