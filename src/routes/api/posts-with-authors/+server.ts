import { json } from '@sveltejs/kit';
import { db } from '$lib/server/drizzle';
import { posts, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticateRequest } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
  try {
    console.log('Fetching posts with authors...');
    
    // Authenticate the request
    const { user } = await authenticateRequest(event);
    
    // Start with a basic query to check database connectivity
    try {
      // Try a simple query first to validate connection
      const testQuery = await db.select().from(users).limit(1);
      console.log('Database connection test successful:', testQuery.length);
    } catch (dbTestError) {
      console.error('Database connection test failed:', dbTestError);
      return json({ 
        error: 'Database connection failed', 
        details: dbTestError instanceof Error ? dbTestError.message : String(dbTestError)
      }, { status: 500 });
    }

    // If we get here, connection is working, so try the full query
    const postsWithAuthors = await db
      .select({
        post: posts,
        author: users
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id));

    console.log(`Successfully retrieved ${postsWithAuthors.length} posts`);
    return json(postsWithAuthors);
  } catch (error) {
    console.error('Error fetching posts with authors:', error);
    return json({ 
      error: 'Failed to fetch posts with authors',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
