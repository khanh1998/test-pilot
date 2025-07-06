import { relations } from 'drizzle-orm';
import { users, posts, apis, apiEndpoints, testFlows, testFlowApis } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  apis: many(apis),
  testFlows: many(testFlows)
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
  endpoints: many(apiEndpoints),
  testFlowApis: many(testFlowApis)
}));

export const apiEndpointsRelations = relations(apiEndpoints, ({ one }) => ({
  api: one(apis, {
    fields: [apiEndpoints.apiId],
    references: [apis.id]
  })
}));

export const testFlowsRelations = relations(testFlows, ({ one, many }) => ({
  user: one(users, {
    fields: [testFlows.userId],
    references: [users.id]
  }),
  testFlowApis: many(testFlowApis)
}));

export const testFlowApisRelations = relations(testFlowApis, ({ one }) => ({
  testFlow: one(testFlows, {
    fields: [testFlowApis.testFlowId],
    references: [testFlows.id]
  }),
  api: one(apis, {
    fields: [testFlowApis.apiId],
    references: [apis.id]
  })
}));
