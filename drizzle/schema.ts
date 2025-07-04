import { pgTable, unique, serial, text, varchar, timestamp, foreignKey, integer, jsonb } from "drizzle-orm/pg-core"
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

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	content: text(),
	authorId: integer("author_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "posts_author_id_users_id_fk"
		}),
]);

export const apis = pgTable("apis", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	specFormat: varchar({ length: 10 }).notNull(), // "yaml" or "json"
	specContent: text().notNull(), // The full OpenAPI/Swagger spec content
	userId: integer("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
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
	method: varchar({ length: 10 }).notNull(), // GET, POST, PUT, DELETE, etc.
	operationId: text(),
	summary: text(),
	description: text(),
	requestSchema: jsonb("request_schema"),
	responseSchema: jsonb("response_schema"),
	parameters: jsonb("parameters"),
	tags: text().array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.apiId],
		foreignColumns: [apis.id],
		name: "api_endpoints_api_id_apis_id_fk"
	}),
]);
