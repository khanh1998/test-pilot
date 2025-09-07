import { relations } from 'drizzle-orm';
import { users, apis, apiEndpoints, testFlows, testFlowApis, endpointEmbeddings, environments, environmentApis, projects, sequences } from './schema';

export const usersRelations = relations(users, ({ many }) => ({
  apis: many(apis),
  testFlows: many(testFlows),
  environments: many(environments),
  projects: many(projects)
}));

export const apisRelations = relations(apis, ({ one, many }) => ({
  user: one(users, {
    fields: [apis.userId],
    references: [users.id]
  }),
  endpoints: many(apiEndpoints),
  testFlowApis: many(testFlowApis),
  environmentApis: many(environmentApis)
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
  environment: one(environments, {
    fields: [testFlows.environmentId],
    references: [environments.id]
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

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  user: one(users, {
    fields: [environments.userId],
    references: [users.id]
  }),
  environmentApis: many(environmentApis),
  testFlows: many(testFlows)
}));

export const environmentApisRelations = relations(environmentApis, ({ one }) => ({
  environment: one(environments, {
    fields: [environmentApis.environmentId],
    references: [environments.id]
  }),
  api: one(apis, {
    fields: [environmentApis.apiId],
    references: [apis.id]
  })
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id]
  }),
  sequences: many(sequences)
}));

export const sequencesRelations = relations(sequences, ({ one }) => ({
  project: one(projects, {
    fields: [sequences.projectId],
    references: [projects.id]
  })
}));
