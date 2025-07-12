import type { apiEndpoints, apis } from '$lib/server/db/schema';

export type Api = Omit<typeof apis.$inferSelect, 'specFormat' | 'specContent' | 'userId'> & {
	endpointCount?: number;
};

export type ApiEndpoint = typeof apiEndpoints.$inferSelect;

export type GetApisResponse = {
	apis: Api[];
};

export type GetApiEndpointsResponse = {
	endpoints: ApiEndpoint[];
};

export type GetApiDetailsResponse = {
	api: Api;
};

export type UploadSwaggerResponse = {
	id: number;
	name: string;
	description: string | null;
	host: string | null;
};

export type UpdateSwaggerResponse = UploadSwaggerResponse;

export type DeleteApiResponse = {
	success: boolean;
	message: string;
};

export type ErrorResponse = {
	error: string;
	details?: string;
};