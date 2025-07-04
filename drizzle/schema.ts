import { pgTable, unique, serial, text, varchar, timestamp, foreignKey, integer } from "drizzle-orm/pg-core"
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
