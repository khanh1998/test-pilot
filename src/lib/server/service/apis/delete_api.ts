import * as apiRepo from '$lib/server/repository/db/apis';

interface DeleteApiParams {
  apiId: number;
  userId: number;
}

interface DeleteApiResponse {
  success: boolean;
  message: string;
}

export async function deleteApi(params: DeleteApiParams): Promise<DeleteApiResponse> {
  const { apiId, userId } = params;

  // Check if API exists and verify ownership
  const api = await apiRepo.getApiById(apiId);

  if (!api) {
    throw new Error('API not found');
  }

  if (api.userId !== userId) {
    throw new Error('Unauthorized to delete this API');
  }

  // Delete the API and its related data
  await apiRepo.deleteApiById(apiId);

  return {
    success: true,
    message: 'API and all its endpoints deleted successfully'
  };
}
