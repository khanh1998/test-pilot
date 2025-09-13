import { ProjectEnvironmentRepository } from '../../repository/db/project_environment.js';
import { ProjectRepository } from '../../repository/db/project.js';
import type { 
  ProjectEnvironmentLink,
  LinkEnvironmentRequest,
  UpdateEnvironmentLinkRequest,
  ProjectEnvironmentListResponse
} from '../../../types/project_environment.js';

export class ProjectEnvironmentService {
  private envRepo: ProjectEnvironmentRepository;
  private projectRepo: ProjectRepository;

  constructor() {
    this.envRepo = new ProjectEnvironmentRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * List all environment links for a project
   */
  async listProjectEnvironments(projectId: number, userId: number): Promise<ProjectEnvironmentListResponse> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return await this.envRepo.listProjectEnvironments(projectId);
  }

  /**
   * Get a specific environment link
   */
  async getProjectEnvironment(projectId: number, environmentId: number, userId: number): Promise<ProjectEnvironmentLink> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const environmentLink = await this.envRepo.getProjectEnvironment(projectId, environmentId);
    if (!environmentLink) {
      throw new Error('Environment link not found');
    }

    return environmentLink;
  }

  /**
   * Link environment to project
   */
  async linkEnvironment(projectId: number, userId: number, data: LinkEnvironmentRequest): Promise<ProjectEnvironmentLink> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // TODO: Verify the environment belongs to the user
    // This would require checking with the environment repository

    // Check if environment is already linked
    const existingLink = await this.envRepo.isEnvironmentLinked(projectId, data.environmentId);
    if (existingLink) {
      throw new Error('Environment is already linked to this project');
    }

    return await this.envRepo.linkEnvironment(projectId, data);
  }

  /**
   * Update environment link
   */
  async updateEnvironmentLink(
    projectId: number, 
    environmentId: number, 
    userId: number, 
    data: UpdateEnvironmentLinkRequest
  ): Promise<ProjectEnvironmentLink> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const updatedLink = await this.envRepo.updateEnvironmentLink(projectId, environmentId, data);
    
    if (!updatedLink) {
      throw new Error('Environment link not found');
    }

    return updatedLink;
  }

  /**
   * Unlink environment from project
   */
  async unlinkEnvironment(projectId: number, environmentId: number, userId: number): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const unlinked = await this.envRepo.unlinkEnvironment(projectId, environmentId);
    
    if (!unlinked) {
      throw new Error('Environment link not found');
    }
  }
}
