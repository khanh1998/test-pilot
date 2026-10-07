import * as apiRepo from '$lib/server/repository/db/apis';
import { ApiManagementError } from './errors';
import { findApiFlowReferences } from './find_api_flow_references';

interface DeleteApiParams {
  apiId: number;
  userId: number;
  /** Delete even when saved test flows use this API's endpoints. */
  force?: boolean;
}

interface DeleteApiResponse {
  success: boolean;
  message: string;
  affectedFlows: Array<{ id: number; name: string }>;
}

export async function deleteApi(params: DeleteApiParams): Promise<DeleteApiResponse> {
  const { apiId, userId, force = false } = params;

  // Check if API exists and verify ownership
  const api = await apiRepo.getApiById(apiId);

  if (!api) {
    throw new ApiManagementError('API not found', 'NOT_FOUND');
  }

  if (api.userId !== userId) {
    throw new ApiManagementError('Unauthorized to delete this API', 'FORBIDDEN');
  }

  const affectedFlows = await findApiFlowReferences(apiId, userId);
  if (affectedFlows.length > 0 && !force) {
    throw new ApiManagementError(
      `API is used by ${affectedFlows.length} test flow${affectedFlows.length === 1 ? '' : 's'}: ${affectedFlows
        .map((flow) => `${flow.name} (id ${flow.id})`)
        .join(', ')}`,
      'IN_USE',
      affectedFlows
    );
  }

  // Delete the API and its related data
  await apiRepo.deleteApiById(apiId);

  return {
    success: true,
    message: 'API and all its endpoints deleted successfully',
    affectedFlows
  };
}
