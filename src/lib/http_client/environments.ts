/**
 * HTTP client for environment management
 */

import { fetchWithAuth } from './util';
import type { Environment, CreateEnvironmentData, UpdateEnvironmentData } from '$lib/types/environment';

/**
 * Create a new environment
 */
export async function createEnvironment(data: CreateEnvironmentData): Promise<Environment> {
  try {
    const response = await fetchWithAuth('/api/environments', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create environment');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating environment:', error);
    throw error;
  }
}

/**
 * Get all environments for the current user
 */
export async function getEnvironments(): Promise<Environment[]> {
  try {
    const response = await fetchWithAuth('/api/environments');

    if (!response.ok) {
      console.error('Failed to fetch environments:', response.statusText);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching environments:', error);
    return [];
  }
}

/**
 * Get a specific environment by ID
 */
export async function getEnvironment(envId: number): Promise<Environment | null> {
  try {
    const response = await fetchWithAuth(`/api/environments/${envId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch environment');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching environment ${envId}:`, error);
    throw error;
  }
}

/**
 * Update an environment
 */
export async function updateEnvironment(envId: number, data: UpdateEnvironmentData): Promise<Environment | null> {
  try {
    const response = await fetchWithAuth(`/api/environments/${envId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update environment');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error updating environment ${envId}:`, error);
    throw error;
  }
}

/**
 * Delete an environment
 */
export async function deleteEnvironment(envId: number): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/environments/${envId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete environment');
    }

    return true;
  } catch (error) {
    console.error(`Error deleting environment ${envId}:`, error);
    throw error;
  }
}

/**
 * Link an API to an environment
 */
export async function linkApiToEnvironment(envId: number, apiId: number): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/environments/${envId}/apis/${apiId}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to link API to environment');
    }

    return true;
  } catch (error) {
    console.error(`Error linking API ${apiId} to environment ${envId}:`, error);
    throw error;
  }
}

/**
 * Unlink an API from an environment
 */
export async function unlinkApiFromEnvironment(envId: number, apiId: number): Promise<boolean> {
  try {
    const response = await fetchWithAuth(`/api/environments/${envId}/apis/${apiId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to unlink API from environment');
    }

    return true;
  } catch (error) {
    console.error(`Error unlinking API ${apiId} from environment ${envId}:`, error);
    throw error;
  }
}
