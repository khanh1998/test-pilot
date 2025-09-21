import { FlowSequenceRepository } from '../../repository/db/flow_sequence.js';
import { ProjectModuleRepository } from '../../repository/db/project_module.js';
import { ProjectRepository } from '../../repository/db/project.js';
import type { 
  FlowSequence,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  SequenceListResponse,
  AddFlowToSequenceRequest,
  ReorderSequenceFlowsRequest
} from '../../../types/flow_sequence.js';

export class FlowSequenceService {
  private sequenceRepo: FlowSequenceRepository;
  private moduleRepo: ProjectModuleRepository;
  private projectRepo: ProjectRepository;

  constructor() {
    this.sequenceRepo = new FlowSequenceRepository();
    this.moduleRepo = new ProjectModuleRepository();
    this.projectRepo = new ProjectRepository();
  }

  /**
   * List all sequences for a module
   */
  async listModuleSequences(moduleId: number, projectId: number, userId: number): Promise<SequenceListResponse> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);
    
    // Verify module belongs to project
    const module = await this.moduleRepo.getProjectModule(moduleId, projectId);
    if (!module) {
      throw new Error('Module not found');
    }

    return await this.sequenceRepo.listModuleSequences(moduleId);
  }

  /**
   * List all sequences for a project (across all modules)
   */
  async listProjectSequences(projectId: number, userId: number): Promise<SequenceListResponse> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    return await this.sequenceRepo.listProjectSequences(projectId);
  }

  /**
   * Get a specific sequence
   */
  async getFlowSequence(sequenceId: number, moduleId: number, projectId: number, userId: number): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    const sequence = await this.sequenceRepo.getFlowSequence(sequenceId, moduleId);
    if (!sequence) {
      throw new Error('Sequence not found');
    }

    return sequence;
  }

  /**
   * Create a new sequence
   */
  async createSequence(moduleId: number, projectId: number, userId: number, data: CreateSequenceRequest): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);
    
    // Verify module belongs to project
    const module = await this.moduleRepo.getProjectModule(moduleId, projectId);
    if (!module) {
      throw new Error('Module not found');
    }

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Sequence name is required');
    }

    if (data.name.trim().length > 255) {
      throw new Error('Sequence name cannot exceed 255 characters');
    }

    const createData = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim()
    };

    return await this.sequenceRepo.createSequence(moduleId, createData);
  }

  /**
   * Update sequence
   */
  async updateSequence(
    sequenceId: number, 
    moduleId: number, 
    projectId: number, 
    userId: number, 
    data: UpdateSequenceRequest
  ): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Sequence name cannot be empty');
      }
      if (data.name.trim().length > 255) {
        throw new Error('Sequence name cannot exceed 255 characters');
      }
      data.name = data.name.trim();
    }

    // Validate description if provided
    if (data.description !== undefined) {
      data.description = data.description?.trim();
    }

    const updatedSequence = await this.sequenceRepo.updateSequence(sequenceId, moduleId, data);
    
    if (!updatedSequence) {
      throw new Error('Sequence not found');
    }

    return updatedSequence;
  }

  /**
   * Delete sequence
   */
  async deleteSequence(sequenceId: number, moduleId: number, projectId: number, userId: number): Promise<void> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    const deleted = await this.sequenceRepo.deleteSequence(sequenceId, moduleId);
    
    if (!deleted) {
      throw new Error('Sequence not found');
    }
  }

  /**
   * Clone sequence
   */
  async cloneSequence(
    sequenceId: number,
    moduleId: number,
    projectId: number,
    userId: number,
    data: { name: string; description?: string }
  ): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    // Verify module belongs to project
    const module = await this.moduleRepo.getProjectModule(moduleId, projectId);
    if (!module) {
      throw new Error('Module not found');
    }

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Sequence name is required');
    }

    if (data.name.trim().length > 255) {
      throw new Error('Sequence name cannot exceed 255 characters');
    }

    const cloneData = {
      name: data.name.trim(),
      description: data.description?.trim()
    };

    const clonedSequence = await this.sequenceRepo.cloneSequence(sequenceId, moduleId, cloneData);
    
    if (!clonedSequence) {
      throw new Error('Original sequence not found');
    }

    return clonedSequence;
  }

  /**
   * Add flow to sequence
   */
  async addFlowToSequence(
    sequenceId: number, 
    moduleId: number, 
    projectId: number, 
    userId: number, 
    data: AddFlowToSequenceRequest
  ): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    // TODO: Verify the test flow belongs to the user
    // This would require checking with the test flow repository

    const updatedSequence = await this.sequenceRepo.addFlowToSequence(
      sequenceId, 
      data.test_flow_id, 
      data.step_order, 
      data.parameter_mappings
    );
    
    if (!updatedSequence) {
      throw new Error('Sequence not found');
    }

    return updatedSequence;
  }

  /**
   * Remove flow from sequence
   */
  async removeFlowFromSequence(
    sequenceId: number, 
    stepId: string, 
    moduleId: number, 
    projectId: number, 
    userId: number
  ): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    const updatedSequence = await this.sequenceRepo.removeFlowFromSequence(sequenceId, stepId);
    
    if (!updatedSequence) {
      throw new Error('Sequence not found');
    }

    return updatedSequence;
  }

  /**
   * Reorder flows in sequence
   */
  async reorderSequenceFlows(
    sequenceId: number, 
    moduleId: number, 
    projectId: number, 
    userId: number, 
    data: ReorderSequenceFlowsRequest
  ): Promise<FlowSequence> {
    // Verify user owns the project
    await this.verifyProjectAccess(projectId, userId);

    const updatedSequence = await this.sequenceRepo.reorderSequenceFlows(
      sequenceId, 
      data.flow_orders.map(order => ({
        stepId: order.step_id,
        newOrder: order.new_order
      }))
    );
    
    if (!updatedSequence) {
      throw new Error('Sequence not found');
    }

    return updatedSequence;
  }

  /**
   * Helper method to verify project access
   */
  private async verifyProjectAccess(projectId: number, userId: number): Promise<void> {
    const project = await this.projectRepo.getUserProject(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }
  }
}
