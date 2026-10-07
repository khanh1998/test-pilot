import { apiEndpoints, type apis } from '$lib/server/db/schema';

export type Api = Omit<typeof apis.$inferSelect, 'specFormat' | 'specContent' | 'userId'> & {
  endpointCount?: number;
};

export type ApiEndpoint = typeof apiEndpoints.$inferSelect;

export type EndpointMutationInput = Pick<ApiEndpoint, 'path' | 'method'> & {
  operationId?: string | null;
  summary?: string | null;
  description?: string | null;
  requestSchema?: unknown;
  responseSchema?: unknown;
  parameters: Array<Record<string, unknown>>;
  tags: string[];
};

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
  success: true;
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    projectId: number | null;
    endpointCount: number;
  };
};

export type UpdateSwaggerResponse = {
  success: true;
  api: UploadSwaggerResponse['api'] & {
    updated: true;
    addedEndpoints: number;
    removedEndpoints: number;
  };
};

export type DeleteApiResponse = {
  success: boolean;
  message: string;
  affectedFlows: Array<{ id: number; name: string }>;
};

export type ErrorResponse = {
  error: string;
  details?: string;
};
