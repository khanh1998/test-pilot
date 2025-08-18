import { parseSwaggerSpec, extractEndpoints, extractHost } from '$lib/server/swagger/parser';
import * as apiRepo from '$lib/server/repository/db/apis';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';
import { EndpointEmbeddingsService } from '$lib/server/service/endpoint_embeddings/create_embedding';

interface UpdateSwaggerParams {
  apiId: number;
  content: string;
  format: 'yaml' | 'json';
  userProvidedHost?: string;
  userId: number;
}

interface UpdateSwaggerResponse {
  success: true;
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    endpointCount: number;
    updated: true;
    addedEndpoints: number;
    removedEndpoints: number;
  };
}

export async function updateSwagger(params: UpdateSwaggerParams): Promise<UpdateSwaggerResponse> {
  const { apiId, content, format, userProvidedHost, userId } = params;

  // Check if the API exists and belongs to the user
  const existingApi = await apiRepo.getApiById(apiId, userId);

  if (!existingApi) {
    throw new Error('API not found or you do not have permission to update it');
  }

  // Parse the Swagger/OpenAPI spec
  const api = await parseSwaggerSpec(content, format);

  // Extract host information from the spec
  let hostValue = extractHost(api);

  // If no host in spec but user provided one, use that
  if (!hostValue && userProvidedHost) {
    hostValue = userProvidedHost;
  }

  // Update the API in the database
  await apiRepo.updateApi({
    id: apiId,
    specFormat: format,
    specContent: content,
    host: hostValue,
    updatedAt: new Date()
  });

  // Extract the endpoints from the spec
  const newEndpoints = extractEndpoints(api);

  // Get existing endpoints for this API
  const existingEndpoints = await apiEndpointsRepo.getApiEndpointsByApiId(apiId);

  // Create a map of existing endpoints for quick lookup
  const existingEndpointMap = new Map(
    existingEndpoints.map((endpoint) => [`${endpoint.method}:${endpoint.path}`, endpoint])
  );

  // Track which endpoints are processed to determine which ones to delete
  const processedEndpoints = new Set();
  const embeddingService = new EndpointEmbeddingsService();
  const createdEndpoints = [];
  const updatedEndpoints = [];

  // Process each endpoint from the new spec
  for (const endpoint of newEndpoints) {
    const endpointKey = `${endpoint.method}:${endpoint.path}`;
    processedEndpoints.add(endpointKey);

    const existingEndpoint = existingEndpointMap.get(endpointKey);

    if (existingEndpoint) {
      // Update existing endpoint
      await apiEndpointsRepo.updateApiEndpoint({
        id: existingEndpoint.id,
        operationId: endpoint.operationId,
        summary: endpoint.summary,
        description: endpoint.description,
        requestSchema: endpoint.requestSchema,
        responseSchema: endpoint.responseSchema,
        parameters: endpoint.parameters,
        tags: endpoint.tags
      });
      
      // Add to updated endpoints for embedding processing
      updatedEndpoints.push({
        id: existingEndpoint.id,
        apiId: existingEndpoint.apiId,
        path: existingEndpoint.path,
        method: existingEndpoint.method,
        operationId: endpoint.operationId || null,
        summary: endpoint.summary || null,
        description: endpoint.description || null,
        requestSchema: endpoint.requestSchema,
        responseSchema: endpoint.responseSchema,
        parameters: endpoint.parameters,
        tags: endpoint.tags,
        createdAt: existingEndpoint.createdAt
      });
    } else {
      // Insert new endpoint
      const newDbEndpoints = await apiEndpointsRepo.createApiEndpoints(apiId, [endpoint]);
      createdEndpoints.push(...newDbEndpoints);
    }
  }

  // Process embeddings for created endpoints
  if (createdEndpoints.length > 0) {
    await embeddingService.batchProcessEndpoints(
      createdEndpoints,
      existingApi.name,
      existingApi.description || undefined,
      userId
    );
  }

  // Process embeddings for updated endpoints
  if (updatedEndpoints.length > 0) {
    await embeddingService.batchProcessEndpoints(
      updatedEndpoints,
      existingApi.name,
      existingApi.description || undefined,
      userId
    );
  }

  // Delete endpoints that no longer exist in the spec
  const endpointsToDelete = existingEndpoints.filter(
    (endpoint) => !processedEndpoints.has(`${endpoint.method}:${endpoint.path}`)
  );

  if (endpointsToDelete.length > 0) {
    const idsToDelete = endpointsToDelete.map((e) => e.id);
    await apiEndpointsRepo.deleteApiEndpoints(idsToDelete);
  }

  return {
    success: true,
    api: {
      id: apiId,
      name: existingApi.name,
      description: existingApi.description,
      host: hostValue,
      endpointCount: newEndpoints.length,
      updated: true,
      addedEndpoints: newEndpoints.length - existingEndpoints.length + endpointsToDelete.length,
      removedEndpoints: endpointsToDelete.length
    }
  };
}
