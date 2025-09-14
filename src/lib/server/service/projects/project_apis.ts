import { ProjectRepository } from '$lib/server/repository/db/project';
import * as apiRepo from '$lib/server/repository/db/apis';
import * as projectApiRepo from '$lib/server/repository/db/project_apis';

const projectRepo = new ProjectRepository();

interface ListProjectApisParams {
  projectId: number;
  userId: number;
}

interface LinkApiToProjectParams {
  projectId: number;
  apiId: number;
  defaultHost?: string;
  userId: number;
}

interface UpdateProjectApiParams {
  projectId: number;
  apiId: number;
  defaultHost?: string;
  userId: number;
}

interface UnlinkApiFromProjectParams {
  projectId: number;
  apiId: number;
  userId: number;
}

export async function listProjectApis(params: ListProjectApisParams) {
  const { projectId, userId } = params;

  // Verify project ownership
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found or access denied');
  }

  const projectApis = await projectApiRepo.getProjectApisByProjectId(projectId);
  
  return {
    projectApis
  };
}

export async function linkApiToProject(params: LinkApiToProjectParams) {
  const { projectId, apiId, defaultHost, userId } = params;

  // Verify project ownership
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found or access denied');
  }

  // Verify API ownership
  const api = await apiRepo.getApiById(apiId, userId);
  if (!api) {
    throw new Error('API not found or access denied');
  }

  // Check if already linked
  const existingLink = await projectApiRepo.getProjectApiByIds(projectId, apiId);
  if (existingLink) {
    throw new Error('API is already linked to this project');
  }

  // Create the link
  const projectApi = await projectApiRepo.createProjectApi({
    projectId,
    apiId,
    defaultHost
  });

  return {
    projectApi
  };
}

export async function updateProjectApi(params: UpdateProjectApiParams) {
  const { projectId, apiId, defaultHost, userId } = params;

  // Verify project ownership
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found or access denied');
  }

  // Check if link exists
  const existingLink = await projectApiRepo.getProjectApiByIds(projectId, apiId);
  if (!existingLink) {
    throw new Error('API is not linked to this project');
  }

  // Update the link
  const projectApi = await projectApiRepo.updateProjectApi(existingLink.id, {
    defaultHost
  });

  return {
    projectApi
  };
}

export async function unlinkApiFromProject(params: UnlinkApiFromProjectParams) {
  const { projectId, apiId, userId } = params;

  // Verify project ownership
  const project = await projectRepo.getUserProject(projectId, userId);
  if (!project) {
    throw new Error('Project not found or access denied');
  }

  // Check if link exists
  const existingLink = await projectApiRepo.getProjectApiByIds(projectId, apiId);
  if (!existingLink) {
    throw new Error('API is not linked to this project');
  }

  // Remove the link
  await projectApiRepo.deleteProjectApi(existingLink.id);

  return {
    success: true
  };
}
