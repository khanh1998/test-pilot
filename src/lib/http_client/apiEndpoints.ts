import { fetchWithAuth } from "./util";

export async function getApiEndpoints(apiId: string) {
  try {
    const response = await fetchWithAuth(`/api/apis/${apiId}/endpoints`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch API endpoints:', response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error fetching API endpoints:', error);
    return [];
  }
}
