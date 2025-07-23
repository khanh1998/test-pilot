import { fetchWithAuth } from './util';

export interface EndpointRecommendationParams {
  description: string;
  limit?: number;
  similarityThreshold?: number;
}

export async function getRecommendedEndpoints(params: EndpointRecommendationParams) {
  try {
    const response = await fetchWithAuth('/api/endpoints/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to get recommended endpoints (${response.status})`);
    }
  } catch (error) {
    console.error('Error getting endpoint recommendations:', error);
    throw error;
  }
}
