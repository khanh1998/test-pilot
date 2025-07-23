import { relations } from "drizzle-orm/relations";
import { apiEndpoints, endpointEmbeddings, users, apis, testFlows, testFlowApis } from "./schema";

export const endpointEmbeddingsRelations = relations(endpointEmbeddings, ({one}) => ({
	apiEndpoint: one(apiEndpoints, {
		fields: [endpointEmbeddings.endpointId],
		references: [apiEndpoints.id]
	}),
}));

export const apiEndpointsRelations = relations(apiEndpoints, ({one, many}) => ({
	endpointEmbeddings: many(endpointEmbeddings),
	api: one(apis, {
		fields: [apiEndpoints.apiId],
		references: [apis.id]
	}),
}));

export const apisRelations = relations(apis, ({one, many}) => ({
	user: one(users, {
		fields: [apis.userId],
		references: [users.id]
	}),
	apiEndpoints: many(apiEndpoints),
	testFlowApis: many(testFlowApis),
}));

export const usersRelations = relations(users, ({many}) => ({
	apis: many(apis),
	testFlows: many(testFlows),
}));

export const testFlowsRelations = relations(testFlows, ({one, many}) => ({
	user: one(users, {
		fields: [testFlows.userId],
		references: [users.id]
	}),
	testFlowApis: many(testFlowApis),
}));

export const testFlowApisRelations = relations(testFlowApis, ({one}) => ({
	api: one(apis, {
		fields: [testFlowApis.apiId],
		references: [apis.id]
	}),
	testFlow: one(testFlows, {
		fields: [testFlowApis.testFlowId],
		references: [testFlows.id]
	}),
}));