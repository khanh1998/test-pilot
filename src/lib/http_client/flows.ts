import { fetchWithAuth } from './util';

export interface Flow {
  id: number;
  name: string;
  description: string | null;
  flowJson: any;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
  apis: Array<{
    id: number;
    name: string;
  }>;
}

/**
 * Get all flows for the current user
 */
export async function getFlows(options: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  try {
    const { page = 1, limit = 20, search } = options;
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (search) {
      params.set('search', search);
    }

    const response = await fetchWithAuth(`/api/test-flows?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      return {
        flows: data.testFlows || [],
        total: data.pagination?.total || 0,
        page: data.pagination?.page || 1,
        totalPages: data.pagination?.totalPages || 0
      };
    } else {
      console.error('Failed to fetch flows:', response.statusText);
      return { 
        flows: [], 
        total: 0, 
        page: 1, 
        totalPages: 0 
      };
    }
  } catch (error) {
    console.error('Error fetching flows:', error);
    return { 
      flows: [], 
      total: 0, 
      page: 1, 
      totalPages: 0 
    };
  }
}

/**
 * Get a flow by ID
 */
export async function getFlow(flowId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/test-flows/${flowId}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error(`Failed to fetch flow ${flowId}:`, response.statusText);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching flow ${flowId}:`, error);
    return null;
  }
}

/**
 * Create a new flow
 */
export async function createFlow(data: {
  name: string;
  description?: string;
  apiIds: number[];
  flowJson?: any;
}) {
  try {
    const response = await fetchWithAuth('/api/test-flows', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error('Failed to create flow:', errorData);
      throw new Error(errorData.error || 'Failed to create flow');
    }
  } catch (error) {
    console.error('Error creating flow:', error);
    throw error;
  }
}

/**
 * Update a flow
 */
export async function updateFlow(flowId: string | number, data: {
  name?: string;
  description?: string;
  apiIds?: number[];
  flowJson?: any;
}) {
  try {
    const response = await fetchWithAuth(`/api/test-flows/${flowId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to update flow ${flowId}:`, errorData);
      throw new Error(errorData.error || 'Failed to update flow');
    }
  } catch (error) {
    console.error(`Error updating flow ${flowId}:`, error);
    throw error;
  }
}

/**
 * Delete a flow
 */
export async function deleteFlow(flowId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/test-flows/${flowId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to delete flow ${flowId}:`, errorData);
      throw new Error(errorData.error || 'Failed to delete flow');
    }
  } catch (error) {
    console.error(`Error deleting flow ${flowId}:`, error);
    throw error;
  }
}
