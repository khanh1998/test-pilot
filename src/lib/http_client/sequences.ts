import { fetchWithAuth } from './util';

export interface SequenceParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  value_source: 'project_variable' | 'hardcoded';
  project_variable: string | null;
  hardcoded_value: any;
}

export interface FlowParameterMapping {
  source_type: 'sequence_parameter' | 'previous_flow_output';
  source_reference: string;
}

export interface SequenceFlow {
  test_flow_id: number;
  order_index: number;
  parameter_mappings: Record<string, FlowParameterMapping>;
}

export interface SequenceConfig {
  parameters: Record<string, SequenceParameter>;
  flows: SequenceFlow[];
}

export interface Sequence {
  id: number;
  name: string;
  projectId: number;
  config: SequenceConfig;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSequenceData {
  name: string;
  parameters?: Record<string, SequenceParameter>;
  flows?: SequenceFlow[];
}

export interface UpdateSequenceData {
  name?: string;
  parameters?: Record<string, SequenceParameter>;
  flows?: SequenceFlow[];
}

/**
 * Get all sequences for a project with pagination and search
 */
export async function getSequences(projectId: string | number, options: {
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

    const response = await fetchWithAuth(`/api/projects/${projectId}/sequences?${params.toString()}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch sequences:', response.statusText);
      return { 
        sequences: [], 
        total: 0, 
        page: 1, 
        limit, 
        totalPages: 0 
      };
    }
  } catch (error) {
    console.error('Error fetching sequences:', error);
    return { 
      sequences: [], 
      total: 0, 
      page: 1, 
      limit: 20, 
      totalPages: 0 
    };
  }
}

/**
 * Get a sequence by ID
 */
export async function getSequence(sequenceId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/sequences/${sequenceId}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error(`Failed to fetch sequence ${sequenceId}:`, response.statusText);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching sequence ${sequenceId}:`, error);
    return null;
  }
}

/**
 * Create a new sequence in a project
 */
export async function createSequence(projectId: string | number, data: CreateSequenceData) {
  try {
    const response = await fetchWithAuth(`/api/projects/${projectId}/sequences`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error('Failed to create sequence:', errorData);
      throw new Error(errorData.error || 'Failed to create sequence');
    }
  } catch (error) {
    console.error('Error creating sequence:', error);
    throw error;
  }
}

/**
 * Update a sequence
 */
export async function updateSequence(sequenceId: string | number, data: UpdateSequenceData) {
  try {
    const response = await fetchWithAuth(`/api/sequences/${sequenceId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to update sequence ${sequenceId}:`, errorData);
      throw new Error(errorData.error || 'Failed to update sequence');
    }
  } catch (error) {
    console.error(`Error updating sequence ${sequenceId}:`, error);
    throw error;
  }
}

/**
 * Delete a sequence
 */
export async function deleteSequence(sequenceId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/sequences/${sequenceId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to delete sequence ${sequenceId}:`, errorData);
      throw new Error(errorData.error || 'Failed to delete sequence');
    }
  } catch (error) {
    console.error(`Error deleting sequence ${sequenceId}:`, error);
    throw error;
  }
}
