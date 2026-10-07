import { fetchWithAuth } from './util';
import { isDesktop } from '$lib/environment';
import { uploadFileWithTauri, isTauriUploadAvailable } from '$lib/http_client/tauri/upload';
import { apiUrl } from '$lib/api-config';
import { authStore } from '$lib/store/auth';
import type {
  DeleteApiResponse,
  GetApiDetailsResponse,
  GetApiEndpointsResponse,
  GetApisResponse,
  UpdateSwaggerResponse,
  UploadSwaggerResponse,
  ApiEndpoint,
  EndpointMutationInput
} from '$lib/types/api';

export async function getApiList(projectId?: number): Promise<GetApisResponse | null> {
  try {
    let url = '/api/apis';
    if (projectId !== undefined) {
      url += `?projectId=${projectId}`;
    }

    const response = await fetchWithAuth(url);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch API list:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching API list:', error);
    return null;
  }
}

export async function uploadSwaggerFile(
  file: File,
  name: string,
  description?: string,
  host?: string,
  projectId?: number
): Promise<UploadSwaggerResponse> {
  try {
    // Check if we're in desktop mode and Tauri upload is available
    if (isDesktop && isTauriUploadAvailable()) {
      // Use Tauri raw upload endpoint for desktop mode
      const params = new URLSearchParams();
      params.append('name', name);
      if (description) {
        params.append('description', description);
      }
      if (host) {
        params.append('host', host);
      }
      if (projectId !== undefined) {
        params.append('projectId', projectId.toString());
      }
      params.append('fileName', file.name);

      const uploadUrl = apiUrl(`/swagger/upload-raw?${params.toString()}`);

      // Get auth headers from the auth store and ensure proper typing
      const authHeaders = authStore.getAuthHeaders();
      const headers: Record<string, string> | undefined = authHeaders.Authorization
        ? { Authorization: authHeaders.Authorization }
        : undefined;

      // Upload using Tauri with progress callback
      const result = await uploadFileWithTauri(
        uploadUrl,
        file,
        ({ progress, total }) => {
          console.log(
            `[Tauri Upload] Progress: ${progress}/${total} bytes (${Math.round((progress / total) * 100)}%)`
          );
        },
        headers
      );

      // Parse the result (Tauri upload returns the response body as string)
      return JSON.parse(result);
    } else {
      // Use traditional form data upload for web mode
      const formData = new FormData();
      formData.append('swaggerFile', file);
      formData.append('name', name);
      if (description) {
        formData.append('description', description);
      }
      if (host) {
        formData.append('host', host);
      }
      if (projectId !== undefined) {
        formData.append('projectId', projectId.toString());
      }

      const response = await fetchWithAuth('/api/swagger/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload Swagger file');
      }
    }
  } catch (error) {
    console.error('Error uploading Swagger file:', error);
    throw error;
  }
}

export async function createApi(input: {
  name: string;
  description?: string;
  host?: string;
  projectId?: number;
}): Promise<UploadSwaggerResponse> {
  const response = await fetchWithAuth('/api/apis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Failed to create API');
  return payload;
}

export async function updateSwaggerFile(id: string, file: File): Promise<UpdateSwaggerResponse> {
  try {
    // Check if we're in desktop mode and Tauri upload is available
    if (isDesktop && isTauriUploadAvailable()) {
      // Use Tauri raw upload endpoint for desktop mode
      const params = new URLSearchParams();
      params.append('fileName', file.name);

      const uploadUrl = apiUrl(`/swagger/update-raw/${id}?${params.toString()}`);

      // Get auth headers from the auth store and ensure proper typing
      const authHeaders = authStore.getAuthHeaders();
      const headers: Record<string, string> | undefined = authHeaders.Authorization
        ? { Authorization: authHeaders.Authorization }
        : undefined;

      // Upload using Tauri with progress callback
      const result = await uploadFileWithTauri(
        uploadUrl,
        file,
        ({ progress, total }) => {
          console.log(
            `[Tauri Upload] Update Progress: ${progress}/${total} bytes (${Math.round((progress / total) * 100)}%)`
          );
        },
        headers
      );

      // Parse the result (Tauri upload returns the response body as string)
      return JSON.parse(result);
    } else {
      // Use traditional form data upload for web mode
      const formData = new FormData();
      formData.append('swaggerFile', file);

      const response = await fetchWithAuth(`/api/swagger/update/${id}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update Swagger file');
      }
    }
  } catch (error) {
    console.error('Error updating Swagger file:', error);
    throw error;
  }
}

export async function deleteApi(id: number, force = false): Promise<DeleteApiResponse | null> {
  try {
    const response = await fetchWithAuth(`/api/apis/${id}?force=${force}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      const error = new Error(
        errorData.error || `Failed to delete API (${response.status})`
      ) as Error & { code?: string };
      error.code = errorData.code;
      throw error;
    }
  } catch (error) {
    console.error('Error deleting API:', error);
    throw error;
  }
}

/** Delete an API, asking the user before overriding saved test flows that use it. */
export async function deleteApiConfirmingUsage(id: number): Promise<DeleteApiResponse | null> {
  try {
    return await deleteApi(id);
  } catch (error) {
    const inUse = (error as Error & { code?: string }).code === 'IN_USE';
    if (inUse && confirm(`${(error as Error).message}. Delete it anyway? Those flows will break.`)) {
      return deleteApi(id, true);
    }
    throw error;
  }
}

export async function getApiDetails(id: number): Promise<GetApiDetailsResponse | null> {
  try {
    const response = await fetchWithAuth(`/api/apis/${id}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch API details:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching API details:', error);
    return null;
  }
}

export async function getApiEndpoints(apiId: number): Promise<GetApiEndpointsResponse | null> {
  try {
    const response = await fetchWithAuth(`/api/apis/${apiId}/endpoints`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error(`Failed to fetch endpoints for API ${apiId}:`, response.statusText);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching endpoints for API ${apiId}:`, error);
    return null;
  }
}

export async function createApiEndpoint(
  apiId: number,
  input: EndpointMutationInput
): Promise<ApiEndpoint> {
  const response = await fetchWithAuth(`/api/apis/${apiId}/endpoints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Failed to create endpoint');
  return payload.data;
}

export async function updateApiEndpoint(
  endpointId: number,
  input: EndpointMutationInput
): Promise<ApiEndpoint> {
  const response = await fetchWithAuth(`/api/endpoints/${endpointId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Failed to update endpoint');
  return payload.data;
}

export async function deleteApiEndpoint(endpointId: number, force = false): Promise<void> {
  const response = await fetchWithAuth(`/api/endpoints/${endpointId}?force=${force}`, {
    method: 'DELETE'
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || 'Failed to delete endpoint') as Error & {
      code?: string;
    };
    error.code = payload.code;
    throw error;
  }
}
