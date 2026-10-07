import * as apiRepo from '$lib/server/repository/db/apis';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';
import { ApiManagementError } from './errors';
import { EndpointSearchIndexService } from '$lib/server/service/api_endpoints/search_index';

interface UpdateApiParams {
  apiId: number;
  userId: number;
  name?: string;
  description?: string | null;
  host?: string | null;
}

/** Update an API's name, description, or host without touching its specification. */
export async function updateApi(params: UpdateApiParams) {
  const { apiId, userId, name, description, host } = params;

  const current = await apiRepo.getApiById(apiId, userId);
  if (!current) throw new ApiManagementError('API not found or access denied', 'NOT_FOUND');

  if (name !== undefined && !name.trim())
    throw new ApiManagementError('API name cannot be empty', 'INVALID');
  if (name === undefined && description === undefined && host === undefined) {
    throw new ApiManagementError(
      'Provide at least one of name, description, or host to update',
      'INVALID'
    );
  }

  const updated = await apiRepo.updateApiMetadata({
    id: apiId,
    name: name?.trim(),
    description: description === undefined ? undefined : description?.trim() || null,
    host: host === undefined ? undefined : host?.trim() || null
  });

  // The search text of every endpoint embeds the API name and description.
  if (updated.name !== current.name || updated.description !== current.description) {
    const endpoints = await apiEndpointsRepo.getApiEndpointsByApiId(apiId);
    if (endpoints.length > 0) {
      await new EndpointSearchIndexService().batchProcessEndpoints(
        endpoints,
        updated.name,
        updated.description || undefined,
        userId
      );
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    host: updated.host,
    projectId: updated.projectId,
    updatedAt: updated.updatedAt
  };
}
