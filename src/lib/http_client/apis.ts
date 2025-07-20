import { fetchWithAuth } from './util';
import type {
	DeleteApiResponse,
	GetApiDetailsResponse,
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
	} catch (error) {
		console.error('Error uploading Swagger file:', error);
		throw error;
	}
}

export async function updateSwaggerFile(id: string, file: File): Promise<UpdateSwaggerResponse> {
	try {
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
	} catch (error) {
		console.error('Error updating Swagger file:', error);
		throw error;
	}
}

export async function deleteApi(id: number): Promise<DeleteApiResponse | null> {
	try {
		const response = await fetchWithAuth('/api/apis', {
			method: 'DELETE',
			body: JSON.stringify({ id })
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
