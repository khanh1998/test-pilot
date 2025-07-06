import { pgTable, text, serial, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

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
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// API Endpoints table - stores individual endpoints extracted from APIs
export const apiEndpoints = pgTable('api_endpoints', {
  id: serial('id').primaryKey(),
  apiId: integer('api_id').notNull().references(() => apis.id),
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
  testFlowId: integer('test_flow_id').notNull().references(() => testFlows.id),
  apiId: integer('api_id').notNull().references(() => apis.id),
  // Composite primary key is defined in relations.ts
});
