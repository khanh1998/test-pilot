import { db } from '../../db/index.js';
import { projectModules, flowSequences } from '../../db/schema.js';
import { eq, and, desc, asc, count } from 'drizzle-orm';
import type { 
  ProjectModule,
  CreateModuleRequest,
  UpdateModuleRequest,
  ModuleListResponse
} from '../../../types/flow_sequence.js';

export class ProjectModuleRepository {
  /**
   * Get all modules for a project
   */
  async listProjectModules(projectId: number): Promise<ModuleListResponse> {
    const modulesResult = await db
      .select({
        id: projectModules.id,
        projectId: projectModules.projectId,
        name: projectModules.name,
        description: projectModules.description,
        displayOrder: projectModules.displayOrder,
        createdAt: projectModules.createdAt,
        updatedAt: projectModules.updatedAt,
        sequenceCount: count(flowSequences.id)
      })
      .from(projectModules)
      .leftJoin(flowSequences, eq(projectModules.id, flowSequences.moduleId))
      .where(eq(projectModules.projectId, projectId))
      .groupBy(
        projectModules.id,
        projectModules.projectId,
        projectModules.name,
        projectModules.description,
        projectModules.displayOrder,
        projectModules.createdAt,
        projectModules.updatedAt
      )
      .orderBy(asc(projectModules.displayOrder), asc(projectModules.name));

    return {
      modules: modulesResult.map(this.mapToProjectModule),
      total: modulesResult.length
    };
  }

  /**
   * Get a single module by ID
   */
  async getProjectModule(moduleId: number, projectId: number): Promise<ProjectModule | null> {
    const result = await db
      .select()
      .from(projectModules)
      .where(and(eq(projectModules.id, moduleId), eq(projectModules.projectId, projectId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToProjectModule(result[0]);
  }

  /**
   * Create a new module
   */
  async createModule(projectId: number, data: CreateModuleRequest): Promise<ProjectModule> {
    const result = await db
      .insert(projectModules)
      .values({
        projectId,
        name: data.name,
        description: data.description,
        displayOrder: data.displayOrder || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.mapToProjectModule(result[0]);
  }

  /**
   * Update module
   */
  async updateModule(moduleId: number, projectId: number, data: UpdateModuleRequest): Promise<ProjectModule | null> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    const result = await db
      .update(projectModules)
      .set(updateData)
      .where(and(eq(projectModules.id, moduleId), eq(projectModules.projectId, projectId)))
      .returning();

    if (result.length === 0) {
      return null;
    }

    return this.mapToProjectModule(result[0]);
  }

  /**
   * Delete module
   */
  async deleteModule(moduleId: number, projectId: number): Promise<boolean> {
    const result = await db
      .delete(projectModules)
      .where(and(eq(projectModules.id, moduleId), eq(projectModules.projectId, projectId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Reorder modules within a project
   */
  async reorderModules(projectId: number, moduleOrders: Array<{ id: number; displayOrder: number }>): Promise<void> {
    // Use a transaction to update all orders atomically
    await db.transaction(async (tx) => {
      for (const { id, displayOrder } of moduleOrders) {
        await tx
          .update(projectModules)
          .set({ displayOrder, updatedAt: new Date() })
          .where(and(eq(projectModules.id, id), eq(projectModules.projectId, projectId)));
      }
    });
  }

  /**
   * Map database row to ProjectModule type
   */
  private mapToProjectModule(row: any): ProjectModule {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description || undefined,
      displayOrder: row.displayOrder || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sequenceCount: row.sequenceCount || undefined
    };
  }
}
