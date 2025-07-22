import { relations } from 'drizzle-orm';
import { users, apis, apiEndpoints, testFlows, testFlowApis, endpointEmbeddings } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  apis: many(apis),
  testFlows: many(testFlows)
}));

export const apisRelations = relations(apis, ({ one, many }) => ({
  user: one(users, {
    fields: [apis.userId],
    references: [users.id]
  }),
  endpoints: many(apiEndpoints),
  testFlowApis: many(testFlowApis)
}));

export const apiEndpointsRelations = relations(apiEndpoints, ({ one, many }) => ({
  api: one(apis, {
    fields: [apiEndpoints.apiId],
    references: [apis.id]
  }),
  embeddings: many(endpointEmbeddings)
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

export const endpointEmbeddingsRelations = relations(endpointEmbeddings, ({ one }) => ({
  endpoint: one(apiEndpoints, {
    fields: [endpointEmbeddings.endpointId],
    references: [apiEndpoints.id]
  })
}));
