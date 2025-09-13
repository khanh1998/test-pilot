/**
 * HTTP client functions for project management
 */

import { fetchWithAuth } from './util.js';
import type { 
  Project, 
  ProjectModule, 
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectListResponse,
  ProjectDetailResponse
} from '../types/project.js';

import type { 
  FlowSequence,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  SequenceListResponse
} from '../types/flow_sequence.js';

import type { 
  ProjectEnvironmentLink,
  LinkEnvironmentRequest 
} from '../types/project_environment.js';

const API_BASE = '/api/projects';

// Project CRUD operations
export async function getProjects(): Promise<ProjectListResponse> {
  const response = await fetchWithAuth(API_BASE);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch projects');
  }
  return response.json();
}

export async function getProject(id: number): Promise<ProjectDetailResponse> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch project');
  }
  return response.json();
}

export async function createProject(data: CreateProjectRequest): Promise<{ project: Project }> {
  const response = await fetchWithAuth(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create project');
  }
  
  return response.json();
}

export async function updateProject(id: number, data: UpdateProjectRequest): Promise<{ project: Project }> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update project');
  }
  
  return response.json();
}

export async function deleteProject(id: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete project');
  }
}

// Module operations
export async function getProjectModules(projectId: number): Promise<{ modules: ProjectModule[] }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch modules');
  }
  return response.json();
}

export async function createModule(projectId: number, data: { name: string; description?: string }): Promise<{ module: ProjectModule }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create module');
  }
  
  return response.json();
}

export async function updateModule(projectId: number, moduleId: number, data: { name?: string; description?: string }): Promise<{ module: ProjectModule }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update module');
  }
  
  return response.json();
}

export async function deleteModule(projectId: number, moduleId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete module');
  }
}

// Sequence operations
export async function getModuleSequences(projectId: number, moduleId: number): Promise<SequenceListResponse> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sequences');
  }
  return response.json();
}

export async function createSequence(projectId: number, moduleId: number, data: CreateSequenceRequest): Promise<{ sequence: FlowSequence }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create sequence');
  }
  
  return response.json();
}

export async function updateSequence(projectId: number, moduleId: number, sequenceId: number, data: UpdateSequenceRequest): Promise<{ sequence: FlowSequence }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences/${sequenceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update sequence');
  }
  
  return response.json();
}

export async function deleteSequence(projectId: number, moduleId: number, sequenceId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences/${sequenceId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete sequence');
  }
}

// Flow management in sequences
export async function addFlowToSequence(
  projectId: number, 
  moduleId: number, 
  sequenceId: number, 
  data: { test_flow_id: number; step_order?: number; parameter_mappings?: any[] }
): Promise<{ result: FlowSequence }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences/${sequenceId}/flows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add flow to sequence');
  }
  
  return response.json();
}

export async function removeFlowFromSequence(
  projectId: number, 
  moduleId: number, 
  sequenceId: number, 
  stepId: string
): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/modules/${moduleId}/sequences/${sequenceId}/flows/${stepId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove flow from sequence');
  }
}

// Environment operations
export async function getProjectEnvironments(projectId: number): Promise<{ environments: ProjectEnvironmentLink[] }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/environments`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch project environments');
  }
  return response.json();
}

export async function linkEnvironment(projectId: number, data: LinkEnvironmentRequest): Promise<{ link: ProjectEnvironmentLink }> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ environment_id: data.environmentId, variableMappings: data.variableMappings })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link environment');
  }
  
  return response.json();
}

export async function unlinkEnvironment(projectId: number, environmentId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${projectId}/environments/${environmentId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink environment');
  }
}
