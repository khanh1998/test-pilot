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
  environmentId: integer('environment_id').references(() => environments.id), // Link to environment for execution
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

// Environments table - stores all environment configurations in JSONB
export const environments = pgTable(
  'environments',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    config: jsonb('config').notNull(), // Stores all environment configuration
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    // Indexes for efficient JSONB queries and relationships
    index('environments_config_gin_idx').using('gin', table.config),
    index('environments_user_id_idx').on(table.userId),
    uniqueIndex('environments_user_name_unique_idx').on(table.userId, table.name) // Prevent duplicate environment names per user
  ]
);

// Link table between environments and APIs
export const environmentApis = pgTable(
  'environment_apis',
  {
    id: serial('id').primaryKey(),
    environmentId: integer('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    apiId: integer('api_id')
      .notNull()
      .references(() => apis.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => [
    index('environment_apis_env_id_idx').on(table.environmentId),
    index('environment_apis_api_id_idx').on(table.apiId),
    uniqueIndex('environment_apis_unique_idx').on(table.environmentId, table.apiId) // One relationship per environment-API pair
  ]
);

// Projects table - containers that group related sequences with shared variables and API dependencies
export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    config: jsonb('config').notNull(), // Stores project configuration
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('projects_config_gin_idx').using('gin', table.config),
    index('projects_user_id_idx').on(table.userId),
    uniqueIndex('projects_user_name_unique_idx').on(table.userId, table.name) // Prevent duplicate project names per user
  ]
);

// Sequences table - ordered collections of test flows with parameters
export const sequences = pgTable(
  'sequences',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    config: jsonb('config').notNull(), // Stores sequence configuration
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => [
    index('sequences_config_gin_idx').using('gin', table.config),
    index('sequences_project_id_idx').on(table.projectId),
    index('sequences_order_idx').on(table.projectId, table.orderIndex),
    uniqueIndex('sequences_project_name_unique_idx').on(table.projectId, table.name) // Prevent duplicate sequence names per project
  ]
);

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
