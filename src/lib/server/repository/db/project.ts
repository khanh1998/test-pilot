import { db } from '../../db/index.js';
import { projects, projectApis, projectEnvironments, projectModules, apis, environments } from '../../db/schema.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import type { 
  Project, 
  ProjectConfig, 
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectListResponse,
  ProjectDetailResponse
} from '../../../types/project.js';

export class ProjectRepository {
  /**
   * Get all projects for a user with pagination
   */
  async listUserProjects(userId: number, limit = 50, offset = 0): Promise<ProjectListResponse> {
    const projectsResult = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId));

    return {
      projects: projectsResult.map(this.mapToProject),
      total: total.length
    };
  }

  /**
   * Get a single project by ID for a user
   */
  async getUserProject(projectId: number, userId: number): Promise<Project | null> {
    const result = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToProject(result[0]);
  }

  /**
   * Get project with all related data (modules, APIs, environments)
   */
  async getProjectDetail(projectId: number, userId: number): Promise<ProjectDetailResponse | null> {
    const project = await this.getUserProject(projectId, userId);
    if (!project) {
      return null;
    }

    // Get modules with sequence count
    const modulesResult = await db
      .select({
        id: projectModules.id,
        projectId: projectModules.projectId,
        name: projectModules.name,
        description: projectModules.description,
        displayOrder: projectModules.displayOrder,
        createdAt: projectModules.createdAt,
        updatedAt: projectModules.updatedAt
      })
      .from(projectModules)
      .where(eq(projectModules.projectId, projectId))
      .orderBy(asc(projectModules.displayOrder), asc(projectModules.name));

    // Get linked APIs
    const apisResult = await db
      .select({
        id: projectApis.id,
        projectId: projectApis.projectId,
        apiId: projectApis.apiId,
        defaultHost: projectApis.defaultHost,
        createdAt: projectApis.createdAt,
        apiName: apis.name,
        apiDescription: apis.description,
        apiHost: apis.host
      })
      .from(projectApis)
      .leftJoin(apis, eq(projectApis.apiId, apis.id))
      .where(eq(projectApis.projectId, projectId));

    // Get linked environments
    const environmentsResult = await db
      .select({
        id: projectEnvironments.id,
        projectId: projectEnvironments.projectId,
        environmentId: projectEnvironments.environmentId,
        variableMappings: projectEnvironments.variableMappings,
        createdAt: projectEnvironments.createdAt,
        envName: environments.name,
        envDescription: environments.description
      })
      .from(projectEnvironments)
      .leftJoin(environments, eq(projectEnvironments.environmentId, environments.id))
      .where(eq(projectEnvironments.projectId, projectId));

    return {
      project,
      modules: modulesResult.map(module => ({
        ...module,
        description: module.description || undefined,
        displayOrder: module.displayOrder || 0
      })),
      apis: apisResult.map(api => ({
        id: api.id,
        projectId: api.projectId,
        apiId: api.apiId,
        defaultHost: api.defaultHost || undefined,
        createdAt: api.createdAt,
        api: {
          id: api.apiId,
          name: api.apiName || '',
          description: api.apiDescription || undefined,
          host: api.apiHost || undefined
        }
      })),
      environments: environmentsResult.map(env => ({
        id: env.id,
        projectId: env.projectId,
        environmentId: env.environmentId,
        variableMappings: env.variableMappings as Record<string, string>,
        createdAt: env.createdAt,
        environment: {
          id: env.environmentId,
          name: env.envName || '',
          description: env.envDescription || undefined
        }
      }))
    };
  }

  /**
   * Create a new project
   */
  async createProject(userId: number, data: CreateProjectRequest): Promise<Project> {
    const projectConfig: ProjectConfig = {
      variables: [],
      api_hosts: {},
      environment_mappings: []
    };

    const result = await db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description,
        userId,
        projectJson: projectConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    const project = this.mapToProject(result[0]);

    // Link APIs if provided
    if (data.apiIds && data.apiIds.length > 0) {
      await this.linkApisToProject(project.id, data.apiIds);
    }

    return project;
  }

  /**
   * Update project
   */
  async updateProject(projectId: number, userId: number, data: UpdateProjectRequest): Promise<Project | null> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.projectJson !== undefined) updateData.projectJson = data.projectJson;

    const result = await db
      .update(projects)
      .set(updateData)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    if (result.length === 0) {
      return null;
    }

    return this.mapToProject(result[0]);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Link APIs to project
   */
  async linkApisToProject(projectId: number, apiIds: number[]): Promise<void> {
    if (apiIds.length === 0) return;

    const values = apiIds.map(apiId => ({
      projectId,
      apiId,
      createdAt: new Date()
    }));

    await db.insert(projectApis).values(values);
  }

  /**
   * Unlink API from project
   */
  async unlinkApiFromProject(projectId: number, apiId: number): Promise<boolean> {
    const result = await db
      .delete(projectApis)
      .where(and(eq(projectApis.projectId, projectId), eq(projectApis.apiId, apiId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Map database row to Project type
   */
  private mapToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.userId,
      projectJson: row.projectJson as ProjectConfig,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
