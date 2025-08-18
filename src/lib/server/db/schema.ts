import { pgTable, text, serial, varchar, integer, timestamp, jsonb, index, uniqueIndex, customType } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

// Define a custom tsvector type
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// Example users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  supabaseAuthId: text('supabase_auth_id').unique(), // Add this field to link with Supabase auth
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// APIs table - stores uploaded Swagger/OpenAPI specifications
export const apis = pgTable('apis', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  specFormat: varchar('spec_format', { length: 10 }).notNull(), // "yaml" or "json"
  specContent: text('spec_content').notNull(), // The full OpenAPI/Swagger spec content
  host: text('host'), // The host URL for the API (can be extracted from swagger or user-provided)
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// API Endpoints table - stores individual endpoints extracted from APIs
export const apiEndpoints = pgTable('api_endpoints', {
  id: serial('id').primaryKey(),
  apiId: integer('api_id')
    .notNull()
    .references(() => apis.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  method: varchar('method', { length: 10 }).notNull(), // GET, POST, PUT, DELETE, etc.
  operationId: text('operation_id'),
  summary: text('summary'),
  description: text('description'),
  requestSchema: jsonb('request_schema'),
  responseSchema: jsonb('response_schema'),
  parameters: jsonb('parameters'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Test Flows table - stores blueprints for API test flows
export const testFlows = pgTable('test_flows', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  userId: integer('user_id').references(() => users.id),
  flowJson: jsonb('flow_json').notNull(), // Will store the entire flow structure including steps, inputs, assertions
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Join table for many-to-many relationship between test_flows and apis
export const testFlowApis = pgTable('test_flow_apis', {
  testFlowId: integer('test_flow_id')
    .notNull()
    .references(() => testFlows.id, { onDelete: 'cascade' }),
  apiId: integer('api_id')
    .notNull()
    .references(() => apis.id, { onDelete: 'cascade' })
  // Composite primary key is defined in relations.ts
});

// Endpoint embeddings table for vector similarity search
export const endpointEmbeddings = pgTable(
  'endpoint_embeddings',
  {
    id: serial('id').primaryKey(),
    endpointId: integer('endpoint_id')
      .notNull()
      .references(() => apiEndpoints.id, { onDelete: 'cascade' }),
    userId: integer('user_id'), // Added for direct user filtering
    apiId: integer('api_id'),   // Added for optional API filtering
    embedding: vector('embedding', { dimensions: 1536 }), // Dimension based on embedding model (e.g., OpenAI's ada-002)
    searchVector: tsvector('search_vector'),
    processedText: text('processed_text'),
    version: integer('version').default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('embedding_idx').using('ivfflat', table.embedding.op('vector_cosine_ops')),
    uniqueIndex('endpoint_id_unique_idx').on(table.endpointId),
    index('user_api_idx').on(table.userId, table.apiId), // Compound index for filtering by user and optionally API
    index('fts_idx').using('gin', table.searchVector)
  ]
);
