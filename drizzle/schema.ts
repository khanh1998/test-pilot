import { pgTable, unique, serial, text, varchar, timestamp, index, uniqueIndex, foreignKey, integer, vector, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	email: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	supabaseAuthId: text("supabase_auth_id"),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_supabase_auth_id_unique").on(table.supabaseAuthId),
]);

export const endpointEmbeddings = pgTable("endpoint_embeddings", {
	id: serial().primaryKey().notNull(),
	endpointId: integer("endpoint_id").notNull(),
	embedding: vector({ dimensions: 1536 }),
	processedText: text("processed_text"),
	version: integer().default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: integer("user_id"),
	apiId: integer("api_id"),
}, (table) => [
	index("embedding_idx").using("ivfflat", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	uniqueIndex("endpoint_id_unique_idx").using("btree", table.endpointId.asc().nullsLast().op("int4_ops")),
	index("user_api_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.apiId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.endpointId],
			foreignColumns: [apiEndpoints.id],
			name: "endpoint_embeddings_endpoint_id_api_endpoints_id_fk"
		}),
]);

export const apis = pgTable("apis", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	specFormat: varchar("spec_format", { length: 10 }).notNull(),
	specContent: text("spec_content").notNull(),
	userId: integer("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	host: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "apis_user_id_users_id_fk"
		}),
]);

export const apiEndpoints = pgTable("api_endpoints", {
	id: serial().primaryKey().notNull(),
	apiId: integer("api_id").notNull(),
	path: text().notNull(),
	method: varchar({ length: 10 }).notNull(),
	operationId: text("operation_id"),
	summary: text(),
	description: text(),
	requestSchema: jsonb("request_schema"),
	responseSchema: jsonb("response_schema"),
	parameters: jsonb(),
	tags: text().array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.apiId],
			foreignColumns: [apis.id],
			name: "api_endpoints_api_id_apis_id_fk"
		}),
]);

export const testFlows = pgTable("test_flows", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	userId: integer("user_id"),
	flowJson: jsonb("flow_json").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "test_flows_user_id_users_id_fk"
		}),
]);

export const testFlowApis = pgTable("test_flow_apis", {
	testFlowId: integer("test_flow_id").notNull(),
	apiId: integer("api_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.apiId],
			foreignColumns: [apis.id],
			name: "test_flow_apis_api_id_apis_id_fk"
		}),
	foreignKey({
			columns: [table.testFlowId],
			foreignColumns: [testFlows.id],
			name: "test_flow_apis_test_flow_id_test_flows_id_fk"
		}),
]);
