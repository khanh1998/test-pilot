import { parseSwaggerSpec, extractEndpoints, extractHost } from '$lib/server/swagger/parser';
import * as apiRepo from '$lib/server/repository/db/apis';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';
import * as projectApisRepo from '$lib/server/repository/db/project_apis';
import { ProjectRepository } from '$lib/server/repository/db/project';
import { EndpointEmbeddingsService } from '$lib/server/service/endpoint_embeddings/create_embedding';

interface UploadSwaggerParams {
  name: string;
  description?: string;
  content: string;
  format: 'yaml' | 'json';
  userProvidedHost?: string;
  userId: number;
  projectId?: number;
}

interface UploadSwaggerResponse {
  success: true;
  api: {
    id: number;
    name: string;
    description: string | null;
    host: string | null;
    projectId: number | null;
    endpointCount: number;
  };
}

export async function uploadSwagger(params: UploadSwaggerParams): Promise<UploadSwaggerResponse> {
  const { name, description, content, format, userProvidedHost, userId, projectId } = params;

  if (projectId !== undefined) {
    const projectRepo = new ProjectRepository();
    const project = await projectRepo.getUserProject(projectId, userId);

    if (!project) {
      throw new Error('Project not found or access denied');
    }
  }

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
    userId,
    projectId
  });

  if (projectId !== undefined) {
    await projectApisRepo.createProjectApi({
      projectId,
      apiId: createdApi.id,
      defaultHost: hostValue ?? undefined
    });
  }

  // Extract the endpoints from the spec
  const endpoints = extractEndpoints(api);

  // Create the endpoints in the database
  const createdEndpoints = [];
  if (endpoints.length > 0) {
    const dbEndpoints = await apiEndpointsRepo.createApiEndpoints(createdApi.id, endpoints);
    createdEndpoints.push(...dbEndpoints);
  }

  // Create embeddings for all created endpoints
  if (createdEndpoints.length > 0) {
    const embeddingService = new EndpointEmbeddingsService();
    await embeddingService.batchProcessEndpoints(
      createdEndpoints,
      createdApi.name,
      createdApi.description || undefined,
      userId
    );
  }

  return {
    success: true,
    api: {
      id: createdApi.id,
      name: createdApi.name,
      description: createdApi.description,
      host: createdApi.host,
      projectId: createdApi.projectId,
      endpointCount: endpoints.length
    }
  };
}
