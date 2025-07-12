/**
 * WARNING: This file should ONLY be imported in server-side code.
 *
 * For security and to avoid "Buffer is not defined" errors,
 * never import this file or any Node.js modules in client components.
 *
 * Always use API endpoints for database operations.
 */

// Re-export the db instance from the server directory
export { db } from '../lib/server/drizzle';

// Export schema and relations
export * from './schema';
export * from './relations';
