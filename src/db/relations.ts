import { relations } from 'drizzle-orm';
import { users, posts, apis, apiEndpoints } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  apis: many(apis)
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id]
  })
}));

export const apisRelations = relations(apis, ({ one, many }) => ({
  user: one(users, {
    fields: [apis.userId],
    references: [users.id]
  }),
  endpoints: many(apiEndpoints)
}));

export const apiEndpointsRelations = relations(apiEndpoints, ({ one }) => ({
  api: one(apis, {
    fields: [apiEndpoints.apiId],
    references: [apis.id]
  })
}));
