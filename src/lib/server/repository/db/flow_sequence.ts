import { db } from '../../db/index.js';
import { flowSequences, projectModules } from '../../db/schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import type { 
  FlowSequence,
  FlowSequenceConfig,
  CreateSequenceRequest,
  UpdateSequenceRequest,
  SequenceListResponse
} from '../../../types/flow_sequence.js';

export class FlowSequenceRepository {
  /**
   * Get all sequences for a module
   */
  async listModuleSequences(moduleId: number): Promise<SequenceListResponse> {
    const sequencesResult = await db
      .select()
      .from(flowSequences)
      .where(eq(flowSequences.moduleId, moduleId))
      .orderBy(asc(flowSequences.displayOrder), asc(flowSequences.name));

    return {
      sequences: sequencesResult.map(this.mapToFlowSequence),
      total: sequencesResult.length
    };
  }

  /**
   * Get sequences for a project (across all modules)
   */
  async listProjectSequences(projectId: number): Promise<SequenceListResponse> {
    const sequencesResult = await db
      .select({
        id: flowSequences.id,
        moduleId: flowSequences.moduleId,
        name: flowSequences.name,
        description: flowSequences.description,
        sequenceConfig: flowSequences.sequenceConfig,
        displayOrder: flowSequences.displayOrder,
        createdAt: flowSequences.createdAt,
        updatedAt: flowSequences.updatedAt,
        moduleName: projectModules.name,
        moduleProjectId: projectModules.projectId
      })
      .from(flowSequences)
      .innerJoin(projectModules, eq(flowSequences.moduleId, projectModules.id))
      .where(eq(projectModules.projectId, projectId))
      .orderBy(asc(projectModules.displayOrder), asc(flowSequences.displayOrder), asc(flowSequences.name));

    return {
      sequences: sequencesResult.map(row => ({
        ...this.mapToFlowSequence(row),
        module: {
          id: row.moduleId,
          name: row.moduleName,
          projectId: row.moduleProjectId
        }
      })),
      total: sequencesResult.length
    };
  }

  /**
   * Get a single sequence by ID
   */
  async getFlowSequence(sequenceId: number, moduleId?: number): Promise<FlowSequence | null> {
    const conditions = [eq(flowSequences.id, sequenceId)];
    if (moduleId) {
      conditions.push(eq(flowSequences.moduleId, moduleId));
    }

    const result = await db
      .select()
      .from(flowSequences)
      .where(and(...conditions))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToFlowSequence(result[0]);
  }

  /**
   * Create a new sequence
   */
  async createSequence(moduleId: number, data: CreateSequenceRequest): Promise<FlowSequence> {
    const sequenceConfig: FlowSequenceConfig = data.sequenceConfig || {
      steps: [],
      global_settings: {
        timeout: 30000,
        continue_on_error: false
      }
    };

    const result = await db
      .insert(flowSequences)
      .values({
        moduleId,
        name: data.name,
        description: data.description,
        sequenceConfig,
        displayOrder: data.displayOrder || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.mapToFlowSequence(result[0]);
  }

  /**
   * Update sequence
   */
  async updateSequence(sequenceId: number, moduleId: number, data: UpdateSequenceRequest): Promise<FlowSequence | null> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sequenceConfig !== undefined) updateData.sequenceConfig = data.sequenceConfig;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    const result = await db
      .update(flowSequences)
      .set(updateData)
      .where(and(eq(flowSequences.id, sequenceId), eq(flowSequences.moduleId, moduleId)))
      .returning();

    if (result.length === 0) {
      return null;
    }

    return this.mapToFlowSequence(result[0]);
  }

  /**
   * Delete sequence
   */
  async deleteSequence(sequenceId: number, moduleId: number): Promise<boolean> {
    const result = await db
      .delete(flowSequences)
      .where(and(eq(flowSequences.id, sequenceId), eq(flowSequences.moduleId, moduleId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Clone sequence
   */
  async cloneSequence(sequenceId: number, moduleId: number, data: { name: string; description?: string }): Promise<FlowSequence | null> {
    // Get the original sequence
    const originalSequence = await this.getFlowSequence(sequenceId, moduleId);
    if (!originalSequence) {
      return null;
    }

    // Create cloned sequence config with new step IDs
    const clonedConfig: FlowSequenceConfig = {
      ...originalSequence.sequenceConfig,
      steps: originalSequence.sequenceConfig.steps.map(step => ({
        ...step,
        id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    };

    // Create new sequence with cloned data
    const result = await db
      .insert(flowSequences)
      .values({
        moduleId,
        name: data.name,
        description: data.description,
        sequenceConfig: clonedConfig,
        displayOrder: originalSequence.displayOrder,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.mapToFlowSequence(result[0]);
  }

  /**
   * Add flow to sequence
   */
  async addFlowToSequence(sequenceId: number, testFlowId: number, stepOrder: number, parameterMappings: any[]): Promise<FlowSequence | null> {
    // Get current sequence
    const sequence = await this.getFlowSequence(sequenceId);
    if (!sequence) {
      return null;
    }

    // Add new step to sequence config
    const newStep = {
      id: `step_${Date.now()}`,
      test_flow_id: testFlowId,
      step_order: stepOrder,
      parameter_mappings: parameterMappings
    };

    const updatedConfig = {
      ...sequence.sequenceConfig,
      steps: [...sequence.sequenceConfig.steps, newStep].sort((a, b) => a.step_order - b.step_order)
    };

    const result = await db
      .update(flowSequences)
      .set({
        sequenceConfig: updatedConfig,
        updatedAt: new Date()
      })
      .where(eq(flowSequences.id, sequenceId))
      .returning();

    return result.length > 0 ? this.mapToFlowSequence(result[0]) : null;
  }

  /**
   * Remove flow from sequence
   */
  async removeFlowFromSequence(sequenceId: number, stepId: string): Promise<FlowSequence | null> {
    // Get current sequence
    const sequence = await this.getFlowSequence(sequenceId);
    if (!sequence) {
      return null;
    }

    // Remove step from sequence config
    const updatedConfig = {
      ...sequence.sequenceConfig,
      steps: sequence.sequenceConfig.steps.filter(step => step.id !== stepId)
    };

    const result = await db
      .update(flowSequences)
      .set({
        sequenceConfig: updatedConfig,
        updatedAt: new Date()
      })
      .where(eq(flowSequences.id, sequenceId))
      .returning();

    return result.length > 0 ? this.mapToFlowSequence(result[0]) : null;
  }

  /**
   * Reorder flows in sequence
   */
  async reorderSequenceFlows(sequenceId: number, flowOrders: Array<{ stepId: string; newOrder: number }>): Promise<FlowSequence | null> {
    // Get current sequence
    const sequence = await this.getFlowSequence(sequenceId);
    if (!sequence) {
      return null;
    }

    // Update step orders
    const updatedSteps = sequence.sequenceConfig.steps.map(step => {
      const orderUpdate = flowOrders.find(order => order.stepId === step.id);
      return orderUpdate ? { ...step, step_order: orderUpdate.newOrder } : step;
    }).sort((a, b) => a.step_order - b.step_order);

    const updatedConfig = {
      ...sequence.sequenceConfig,
      steps: updatedSteps
    };

    const result = await db
      .update(flowSequences)
      .set({
        sequenceConfig: updatedConfig,
        updatedAt: new Date()
      })
      .where(eq(flowSequences.id, sequenceId))
      .returning();

    return result.length > 0 ? this.mapToFlowSequence(result[0]) : null;
  }

  /**
   * Map database row to FlowSequence type
   */
  private mapToFlowSequence(row: any): FlowSequence {
    return {
      id: row.id,
      moduleId: row.moduleId,
      name: row.name,
      description: row.description || undefined,
      sequenceConfig: row.sequenceConfig as FlowSequenceConfig,
      displayOrder: row.displayOrder || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
