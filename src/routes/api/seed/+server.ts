import { db } from '$lib/server/drizzle';
import { users, posts } from '../../../db/schema';
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
        const [createdUser] = await db.insert(users)
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

    // Sample data for posts
    const postsData = [
      { title: 'Getting Started with Drizzle ORM', content: 'Drizzle ORM is a lightweight and type-safe ORM for TypeScript...' },
      { title: 'Supabase and SvelteKit Integration', content: 'Supabase provides a great backend-as-a-service option for SvelteKit applications...' }
    ];

    // Create posts - connect to created users if available
    const createdPosts = [];
    for (let i = 0; i < postsData.length; i++) {
      const postData = postsData[i];
      const authorId = createdUsers[i % createdUsers.length]?.id;
      
      if (authorId) {
        try {
          const [createdPost] = await db.insert(posts)
            .values({
              ...postData,
              authorId
            })
            .returning();
          
          if (createdPost) {
            createdPosts.push(createdPost);
          }
        } catch (err) {
          console.error(`Error creating post:`, err);
        }
      }
    }

    // Return the created data
    return json({
      success: true,
      users: createdUsers,
      posts: createdPosts
    });
  } catch (err) {
    console.error('Error seeding data:', err);
    return json({ 
      success: false, 
      error: 'Failed to create sample data' 
    }, { status: 500 });
  }
}
