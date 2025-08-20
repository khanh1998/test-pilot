import { fetchWithAuth } from './util';

export interface EndpointRecommendationParams {
  description: string;
  limit?: number;
  similarityThreshold?: number;
}

export interface SearchEndpointsParams {
  query: string;
  apiId?: number;
  apiIds?: number[];
  limit?: number;
}

export interface SearchEndpointResult {
  id: number;
  apiId: number;
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  relevanceScore: number;
}

export interface EndpointDetails {
  id: number;
  apiId: number;
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  requestSchema?: unknown; // JSON schema for request body
  responseSchema?: unknown; // JSON schema for response body
  parameters?: unknown; // Parameters definition (path, query, header params)
  createdAt: string;
}

export interface SearchEndpointsResponse {
  success: boolean;
  data: SearchEndpointResult[];
  count: number;
}

export async function searchEndpoints(
  params: SearchEndpointsParams
): Promise<SearchEndpointsResponse> {
  try {
    const searchParams = new URLSearchParams({
      query: params.query
    });

    if (params.apiId) {
      searchParams.append('apiId', params.apiId.toString());
    }

    if (params.apiIds && params.apiIds.length > 0) {
      params.apiIds.forEach((id) => {
        searchParams.append('apiIds', id.toString());
      });
    }

    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const response = await fetchWithAuth(`/api/endpoints/search?${searchParams.toString()}`, {
      method: 'GET'
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to search endpoints (${response.status})`);
    }
  } catch (error) {
    console.error('Error searching endpoints:', error);
    throw error;
  }
}

export async function getEndpointById(endpointId: number): Promise<EndpointDetails> {
  try {
    const response = await fetchWithAuth(`/api/endpoints/${endpointId}`, {
      method: 'GET'
    });

    if (response.ok) {
      const data = await response.json();
      return data.data;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch endpoint (${response.status})`);
    }
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    throw error;
  }
}

export async function getRecommendedEndpoints(params: EndpointRecommendationParams) {
  try {
    const response = await fetchWithAuth('/api/endpoints/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `Failed to get recommended endpoints (${response.status})`
      );
    }
  } catch (error) {
    console.error('Error getting endpoint recommendations:', error);
    throw error;
  }
}
