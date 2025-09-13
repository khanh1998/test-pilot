import { db } from '../../db/index.js';
import { projectEnvironments, environments } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { 
  ProjectEnvironmentLink,
  LinkEnvironmentRequest,
  UpdateEnvironmentLinkRequest,
  ProjectEnvironmentListResponse
} from '../../../types/project_environment.js';

export class ProjectEnvironmentRepository {
  /**
   * Get all environment links for a project
   */
  async listProjectEnvironments(projectId: number): Promise<ProjectEnvironmentListResponse> {
    const environmentsResult = await db
      .select({
        id: projectEnvironments.id,
        projectId: projectEnvironments.projectId,
        environmentId: projectEnvironments.environmentId,
        variableMappings: projectEnvironments.variableMappings,
        createdAt: projectEnvironments.createdAt,
        envName: environments.name,
        envDescription: environments.description,
        envConfig: environments.config
      })
      .from(projectEnvironments)
      .leftJoin(environments, eq(projectEnvironments.environmentId, environments.id))
      .where(eq(projectEnvironments.projectId, projectId));

    return {
      environmentLinks: environmentsResult.map(this.mapToProjectEnvironmentLink),
      total: environmentsResult.length
    };
  }

  /**
   * Get a single environment link
   */
  async getProjectEnvironment(projectId: number, environmentId: number): Promise<ProjectEnvironmentLink | null> {
    const result = await db
      .select({
        id: projectEnvironments.id,
        projectId: projectEnvironments.projectId,
        environmentId: projectEnvironments.environmentId,
        variableMappings: projectEnvironments.variableMappings,
        createdAt: projectEnvironments.createdAt,
        envName: environments.name,
        envDescription: environments.description,
        envConfig: environments.config
      })
      .from(projectEnvironments)
      .leftJoin(environments, eq(projectEnvironments.environmentId, environments.id))
      .where(and(
        eq(projectEnvironments.projectId, projectId),
        eq(projectEnvironments.environmentId, environmentId)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToProjectEnvironmentLink(result[0]);
  }

  /**
   * Link environment to project
   */
  async linkEnvironment(projectId: number, data: LinkEnvironmentRequest): Promise<ProjectEnvironmentLink> {
    const result = await db
      .insert(projectEnvironments)
      .values({
        projectId,
        environmentId: data.environmentId,
        variableMappings: data.variableMappings,
        createdAt: new Date()
      })
      .returning();

    // Get the full data with environment details
    const environmentLink = await this.getProjectEnvironment(projectId, data.environmentId);
    if (!environmentLink) {
      throw new Error('Failed to retrieve created environment link');
    }

    return environmentLink;
  }

  /**
   * Update environment link
   */
  async updateEnvironmentLink(
    projectId: number, 
    environmentId: number, 
    data: UpdateEnvironmentLinkRequest
  ): Promise<ProjectEnvironmentLink | null> {
    const result = await db
      .update(projectEnvironments)
      .set({
        variableMappings: data.variableMappings
      })
      .where(and(
        eq(projectEnvironments.projectId, projectId),
        eq(projectEnvironments.environmentId, environmentId)
      ))
      .returning();

    if (result.length === 0) {
      return null;
    }

    return this.getProjectEnvironment(projectId, environmentId);
  }

  /**
   * Unlink environment from project
   */
  async unlinkEnvironment(projectId: number, environmentId: number): Promise<boolean> {
    const result = await db
      .delete(projectEnvironments)
      .where(and(
        eq(projectEnvironments.projectId, projectId),
        eq(projectEnvironments.environmentId, environmentId)
      ))
      .returning();

    return result.length > 0;
  }

  /**
   * Check if environment is linked to project
   */
  async isEnvironmentLinked(projectId: number, environmentId: number): Promise<boolean> {
    const result = await db
      .select({ id: projectEnvironments.id })
      .from(projectEnvironments)
      .where(and(
        eq(projectEnvironments.projectId, projectId),
        eq(projectEnvironments.environmentId, environmentId)
      ))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Map database row to ProjectEnvironmentLink type
   */
  private mapToProjectEnvironmentLink(row: any): ProjectEnvironmentLink {
    return {
      id: row.id,
      projectId: row.projectId,
      environmentId: row.environmentId,
      variableMappings: row.variableMappings as Record<string, string>,
      createdAt: row.createdAt,
      environment: {
        id: row.environmentId,
        name: row.envName || '',
        description: row.envDescription || undefined,
        config: row.envConfig
      }
    };
  }
}
