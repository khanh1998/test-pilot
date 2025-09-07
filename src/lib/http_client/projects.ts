import { fetchWithAuth } from './util';

export interface ProjectVariable {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  value_source: 'environment' | 'hardcoded';
  hardcoded_value: any;
  environment_variable: string | null;
}

export interface ProjectConfig {
  variables: Record<string, ProjectVariable>;
  api_dependencies: number[];
  environment_id: number | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  config: ProjectConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  variables?: Record<string, ProjectVariable>;
  api_dependencies?: number[];
  environment_id?: number | null;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  variables?: Record<string, ProjectVariable>;
  api_dependencies?: number[];
  environment_id?: number | null;
}

/**
 * Get all projects with pagination and search
 */
export async function getProjects(options: {
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

    const response = await fetchWithAuth(`/api/projects?${params.toString()}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error('Failed to fetch projects:', response.statusText);
      return { 
        projects: [], 
        total: 0, 
        page: 1, 
        limit, 
        totalPages: 0 
      };
    }
  } catch (error) {
    console.error('Error fetching projects:', error);
    return { 
      projects: [], 
      total: 0, 
      page: 1, 
      limit: 20, 
      totalPages: 0 
    };
  }
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/projects/${projectId}`);
    if (response.ok) {
      return await response.json();
    } else {
      console.error(`Failed to fetch project ${projectId}:`, response.statusText);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(data: CreateProjectData) {
  try {
    const response = await fetchWithAuth('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error('Failed to create project:', errorData);
      throw new Error(errorData.error || 'Failed to create project');
    }
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Update a project
 */
export async function updateProject(projectId: string | number, data: UpdateProjectData) {
  try {
    const response = await fetchWithAuth(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to update project ${projectId}:`, errorData);
      throw new Error(errorData.error || 'Failed to update project');
    }
  } catch (error) {
    console.error(`Error updating project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string | number) {
  try {
    const response = await fetchWithAuth(`/api/projects/${projectId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      console.error(`Failed to delete project ${projectId}:`, errorData);
      throw new Error(errorData.error || 'Failed to delete project');
    }
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
}
