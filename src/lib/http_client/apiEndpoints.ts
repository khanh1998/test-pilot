import { fetchWithAuth } from './util';
import type { GetApiEndpointsResponse } from '$lib/types/api';

export async function getApiEndpoints(apiId: string): Promise<GetApiEndpointsResponse | null> {
	try {
		const response = await fetchWithAuth(`/api/apis/${apiId}/endpoints`);
		if (response.ok) {
			return await response.json();
		} else {
			console.error('Failed to fetch API endpoints:', response.statusText);
			return null;
		}
	} catch (error) {
		console.error('Error fetching API endpoints:', error);
		return null;
	}
}

