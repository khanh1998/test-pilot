import { ProjectModuleRepository } from '../../repository/db/project_module.js';
import { ProjectRepository } from '../../repository/db/project.js';
import type { 
  ProjectModule,
  CreateModuleRequest,
  UpdateModuleRequest,
  ModuleListResponse
} from '../../../types/flow_sequence.js';

export class ProjectModuleService {
  private moduleRepo: ProjectModuleRepository;
  private projectRepo: ProjectRepository;

  constructor() {
    this.moduleRepo = new ProjectModuleRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * List all modules for a project
   */
  async listProjectModules(projectId: number, userId: number): Promise<ModuleListResponse> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return await this.moduleRepo.listProjectModules(projectId);
  }

  /**
   * Get a specific module
   */
  async getProjectModule(moduleId: number, projectId: number, userId: number): Promise<ProjectModule> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const module = await this.moduleRepo.getProjectModule(moduleId, projectId);
    if (!module) {
      throw new Error('Module not found');
    }

    return module;
  }

  /**
   * Create a new module
   */
  async createModule(projectId: number, userId: number, data: CreateModuleRequest): Promise<ProjectModule> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Module name is required');
    }

    if (data.name.trim().length > 255) {
      throw new Error('Module name cannot exceed 255 characters');
    }

    const createData = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim()
    };

    return await this.moduleRepo.createModule(projectId, createData);
  }

  /**
   * Update module
   */
  async updateModule(moduleId: number, projectId: number, userId: number, data: UpdateModuleRequest): Promise<ProjectModule> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Module name cannot be empty');
      }
      if (data.name.trim().length > 255) {
        throw new Error('Module name cannot exceed 255 characters');
      }
      data.name = data.name.trim();
    }

    // Validate description if provided
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    const updatedModule = await this.moduleRepo.updateModule(moduleId, projectId, data);
    
    if (!updatedModule) {
      throw new Error('Module not found');
    }

    return updatedModule;
  }

  /**
   * Delete module
   */
  async deleteModule(moduleId: number, projectId: number, userId: number): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const deleted = await this.moduleRepo.deleteModule(moduleId, projectId);
    
    if (!deleted) {
      throw new Error('Module not found');
    }
  }

  /**
   * Reorder modules within a project
   */
  async reorderModules(
    projectId: number, 
    userId: number, 
    moduleOrders: Array<{ id: number; displayOrder: number }>
  ): Promise<void> {
    // Verify user owns the project
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Validate that all module IDs belong to the project
    const existingModules = await this.moduleRepo.listProjectModules(projectId);
    const existingModuleIds = new Set(existingModules.modules.map(m => m.id));
    
    for (const order of moduleOrders) {
      if (!existingModuleIds.has(order.id)) {
        throw new Error(`Module ${order.id} does not belong to project ${projectId}`);
      }
    }

    await this.moduleRepo.reorderModules(projectId, moduleOrders);
  }
}
