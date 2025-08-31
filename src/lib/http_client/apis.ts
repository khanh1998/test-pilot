import { fetchWithAuth } from './util';
import { isDesktop } from '$lib/environment';
import { uploadFileWithTauri, isTauriUploadAvailable } from '$lib/tauri/upload';
import { apiUrl } from '$lib/api-config';
import { authStore } from '$lib/store/auth';
import type {
	DeleteApiResponse,
	GetApiDetailsResponse,
	GetApiEndpointsResponse,
	GetApisResponse,
	UpdateSwaggerResponse,
	UploadSwaggerResponse
} from '$lib/types/api';

export async function getApiList(): Promise<GetApisResponse | null> {
	try {
		const response = await fetchWithAuth('/api/apis');
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
	host?: string
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
			params.append('fileName', file.name);
			
			const uploadUrl = apiUrl(`/swagger/upload-raw?${params.toString()}`);
			
			// Get auth headers from the auth store and ensure proper typing
			const authHeaders = authStore.getAuthHeaders();
			const headers: Record<string, string> | undefined = 
				authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : undefined;
			
			// Upload using Tauri with progress callback
			const result = await uploadFileWithTauri(
				uploadUrl,
				file,
				({ progress, total }) => {
					console.log(`[Tauri Upload] Progress: ${progress}/${total} bytes (${Math.round((progress / total) * 100)}%)`);
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
			const headers: Record<string, string> | undefined = 
				authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : undefined;
			
			// Upload using Tauri with progress callback
			const result = await uploadFileWithTauri(
				uploadUrl,
				file,
				({ progress, total }) => {
					console.log(`[Tauri Upload] Update Progress: ${progress}/${total} bytes (${Math.round((progress / total) * 100)}%)`);
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

export async function deleteApi(id: number): Promise<DeleteApiResponse | null> {
	try {
		const response = await fetchWithAuth(`/api/apis/${id}`, {
			method: 'DELETE',
		});
		
		if (response.ok) {
			return await response.json();
		} else {
			const errorData = await response.json();
			throw new Error(errorData.error || `Failed to delete API (${response.status})`);
		}
	} catch (error) {
		console.error('Error deleting API:', error);
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
