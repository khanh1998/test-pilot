import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../db/schema';
import * as relations from '../../db/relations';

// Database connection for server-side API endpoints
// This should only be used in server-side code
let connectionString = process.env.DATABASE_URL;

// For local development, make sure DATABASE_URL is set in .env
if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL not found in environment variables');

  if (process.env.NODE_ENV === 'development') {
    console.warn('Using placeholder connection string for development');
    connectionString = 'postgresql://postgres:password@localhost:5432/postgres';
  } else {
    // In production, we want to fail loudly if DATABASE_URL is missing
    throw new Error('DATABASE_URL is required in production environment');
  }
}

// Configure postgres options
const postgresOptions = {
  max: 10, // Max number of connections in the pool
  idle_timeout: 20, // Max seconds a connection can be idle
  connect_timeout: 30, // Increase timeout for Supabase connections
  prepare: false // For compatibility with some serverless environments
};

// Create postgres client with better error handling
try {
  console.log('Initializing postgres client...');
  var client = postgres(connectionString, postgresOptions);
} catch (err) {
  console.error('Failed to initialize postgres client:', err);
  throw err;
}

// Create drizzle ORM instance
export const db = drizzle(client, {
  schema: { ...schema, ...relations }
});
