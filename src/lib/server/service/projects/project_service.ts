import { ProjectRepository } from '../../repository/db/project.js';
import type { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest,
  ProjectListResponse,
  ProjectDetailResponse
} from '../../../types/project.js';

export class ProjectService {
  private projectRepo: ProjectRepository;

  constructor() {
    this.projectRepo = new ProjectRepository();
  }

  /**
   * List all projects for a user
   */
  async listUserProjects(userId: number, limit = 50, offset = 0): Promise<ProjectListResponse> {
    return await this.projectRepo.listUserProjects(userId, limit, offset);
  }

  /**
   * Get project detail with all related data
   */
  async getProjectDetail(projectId: number, userId: number): Promise<ProjectDetailResponse> {
    const projectDetail = await this.projectRepo.getProjectDetail(projectId, userId);
    
    if (!projectDetail) {
      throw new Error('Project not found or access denied');
    }

    return projectDetail;
  }

  /**
   * Create a new project
   */
  async createProject(userId: number, data: CreateProjectRequest): Promise<Project> {
    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    if (data.name.trim().length > 255) {
      throw new Error('Project name cannot exceed 255 characters');
    }

    // Validate API IDs if provided
    if (data.apiIds && data.apiIds.length > 0) {
      // TODO: Validate that the API IDs belong to the user
      // This would require checking with the API repository
    }

    const createData = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim()
    };

    return await this.projectRepo.createProject(userId, createData);
  }

  /**
   * Update project
   */
  async updateProject(projectId: number, userId: number, data: UpdateProjectRequest): Promise<Project> {
    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Project name cannot be empty');
      }
      if (data.name.trim().length > 255) {
        throw new Error('Project name cannot exceed 255 characters');
      }
      data.name = data.name.trim();
    }

    // Validate description if provided
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    const updatedProject = await this.projectRepo.updateProject(projectId, userId, data);
    
    if (!updatedProject) {
      throw new Error('Project not found or access denied');
    }

    return updatedProject;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: number, userId: number): Promise<void> {
    const deleted = await this.projectRepo.deleteProject(projectId, userId);
    
    if (!deleted) {
      throw new Error('Project not found or access denied');
    }
  }

  /**
   * Link API to project
   */
  async linkApiToProject(projectId: number, userId: number, apiId: number): Promise<void> {
    // First verify the project belongs to the user
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // TODO: Verify the API belongs to the user
    // This would require checking with the API repository

    try {
      await this.projectRepo.linkApisToProject(projectId, [apiId]);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('API is already linked to this project');
      }
      throw error;
    }
  }

  /**
   * Unlink API from project
   */
  async unlinkApiFromProject(projectId: number, userId: number, apiId: number): Promise<void> {
    // First verify the project belongs to the user
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const unlinked = await this.projectRepo.unlinkApiFromProject(projectId, apiId);
    
    if (!unlinked) {
      throw new Error('API link not found');
    }
  }
}
