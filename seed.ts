import 'dotenv/config';
import { db } from './src/lib/server/drizzle';
import { users } from './src/db/schema';

// Check if .env file exists and has DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL is not defined in your environment');
  console.error('Make sure you have a .env file with DATABASE_URL set properly');
  process.exit(1);
}

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Clear existing data
    await db.delete(users);
    console.log('Cleared existing data');

    // Create users
    const usersData = [
      { name: 'Alice Johnson', email: 'alice@example.com' },
      { name: 'Bob Smith', email: 'bob@example.com' },
      { name: 'Carol Williams', email: 'carol@example.com' }
    ];

    const createdUsers = await Promise.all(
      usersData.map(async (user) => {
        const [newUser] = await db.insert(users).values(user).returning();
        return newUser;
      })
    );
    console.log('Created users:', createdUsers);

    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    process.exit(0);
  }
}

seed();
