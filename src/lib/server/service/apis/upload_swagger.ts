import { parseSwaggerSpec, extractEndpoints, extractHost } from '$lib/server/swagger/parser';
import * as apiRepo from '$lib/server/repository/db/apis';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';

interface UploadSwaggerParams {
  name: string;
  description?: string;
  content: string;
  format: 'yaml' | 'json';
  userProvidedHost?: string;
  userId: number;
}

interface UploadSwaggerResponse {
  success: true;
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    endpointCount: number;
  };
}

export async function uploadSwagger(params: UploadSwaggerParams): Promise<UploadSwaggerResponse> {
  const { name, description, content, format, userProvidedHost, userId } = params;

  // Parse the Swagger/OpenAPI spec
  const api = await parseSwaggerSpec(content, format);

  // Extract host information from the spec
  let hostValue = extractHost(api);

  // If no host in spec but user provided one, use that
  if (!hostValue && userProvidedHost) {
    hostValue = userProvidedHost;
  }

  // Create the API in the database
  const createdApi = await apiRepo.createApi({
    name,
    description: description || null,
    specFormat: format,
    specContent: content,
    host: hostValue,
    userId
  });

  // Extract the endpoints from the spec
  const endpoints = extractEndpoints(api);

  // Create the endpoints in the database
  if (endpoints.length > 0) {
    await apiEndpointsRepo.createApiEndpoints(createdApi.id, endpoints);
  }

  return {
    success: true,
    api: {
      id: createdApi.id,
      name: createdApi.name,
      description: createdApi.description,
      host: createdApi.host,
      endpointCount: endpoints.length
    }
  };
}
