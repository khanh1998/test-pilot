import 'dotenv/config';
import { db } from './src/lib/server/drizzle';
import { users, posts } from './src/db/schema';
import fs from 'fs';

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
    await db.delete(posts);
    await db.delete(users);
    console.log('Cleared existing data');

    // Create users
    const usersData = [
      { name: 'Alice Johnson', email: 'alice@example.com' },
      { name: 'Bob Smith', email: 'bob@example.com' },
      { name: 'Carol Williams', email: 'carol@example.com' },
    ];

    const createdUsers = await Promise.all(
      usersData.map(async (user) => {
        const [newUser] = await db.insert(users).values(user).returning();
        return newUser;
      })
    );
    console.log('Created users:', createdUsers);

    // Create posts
    const postsData = [
      { 
        title: 'Getting Started with Drizzle ORM', 
        content: 'Drizzle ORM is a lightweight and type-safe ORM for TypeScript...',
        authorId: createdUsers[0].id 
      },
      { 
        title: 'Supabase and SvelteKit Integration', 
        content: 'Supabase provides a great backend-as-a-service option for SvelteKit applications...',
        authorId: createdUsers[1].id 
      },
      { 
        title: 'Building with SvelteKit', 
        content: 'SvelteKit is a framework for building web applications with Svelte...',
        authorId: createdUsers[0].id 
      },
      { 
        title: 'Drizzle vs Prisma', 
        content: 'Comparing Drizzle ORM and Prisma for TypeScript applications...',
        authorId: createdUsers[2].id 
      },
    ];

    const createdPosts = await Promise.all(
      postsData.map(async (post) => {
        const [newPost] = await db.insert(posts).values(post).returning();
        return newPost;
      })
    );
    console.log('Created posts:', createdPosts);

    console.log('✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    process.exit(0);
  }
}

seed();
