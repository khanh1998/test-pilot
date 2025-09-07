import { db } from '$lib/server/db';
import { projects, apis } from '$lib/server/db/schema';
import { eq, and, desc, ilike, or, count, inArray } from 'drizzle-orm';

export interface ProjectConfig {
  variables: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description: string;
    required: boolean;
    value_source: 'environment' | 'hardcoded';
    hardcoded_value: any;
    environment_variable: string | null;
  }>;
  api_dependencies: number[];
  environment_id: number | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectListItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  apiCount: number;
  sequenceCount: number;
}

/**
 * Get projects for a user with pagination and search
 */
export async function getUserProjects(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<{
  projects: Array<{
    id: number;
    name: string;
    description: string | null;
    config: ProjectConfig;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}> {
  const { limit = 20, offset = 0, search } = options;

  // Build the base query
  let whereConditions = eq(projects.userId, userId);
  
  // Add search condition if provided
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    const searchCondition = or(
      ilike(projects.name, searchTerm),
      ilike(projects.description, searchTerm)
    );
    whereConditions = and(whereConditions, searchCondition)!;
  }

  // Get the total count
  const totalResult = await db
    .select({ count: count() })
    .from(projects)
    .where(whereConditions);
  
  const total = totalResult[0]?.count || 0;

  // Get the paginated results
  const projectsResult = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      config: projects.config,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt
    })
    .from(projects)
    .where(whereConditions)
    .orderBy(desc(projects.updatedAt))
    .limit(limit)
    .offset(offset);

  return {
    projects: projectsResult.map(project => ({
      ...project,
      config: project.config as ProjectConfig
    })),
    total
  };
}

/**
 * Get a project by ID and user ID
 */
export async function getProjectById(id: number, userId: number): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  return project ? {
    ...project,
    config: project.config as ProjectConfig
  } : null;
}

/**
 * Check if a project exists and belongs to a user
 */
export async function projectExistsForUser(projectId: number, userId: number): Promise<boolean> {
  const [result] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  
  return !!result;
}

/**
 * Create a new project
 */
export async function createProject(projectData: {
  name: string;
  description?: string | null;
  userId: number;
  config: ProjectConfig;
}): Promise<Project> {
  const [newProject] = await db
    .insert(projects)
    .values(projectData)
    .returning();
  
  return {
    ...newProject,
    config: newProject.config as ProjectConfig
  };
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: number,
  userId: number,
  updateData: {
    name?: string;
    description?: string | null;
    config?: ProjectConfig;
  }
): Promise<Project | null> {
  const [updatedProject] = await db
    .update(projects)
    .set({
      ...updateData,
      updatedAt: new Date()
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning();
  
  return updatedProject ? {
    ...updatedProject,
    config: updatedProject.config as ProjectConfig
  } : null;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: number, userId: number): Promise<boolean> {
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  
  return result.length > 0;
}

/**
 * Check if project name exists for user
 */
export async function projectNameExists(name: string, userId: number, excludeId?: number): Promise<boolean> {
  let whereConditions = and(eq(projects.name, name), eq(projects.userId, userId));
  
  if (excludeId) {
    whereConditions = and(whereConditions, eq(projects.id, excludeId));
  }
  
  const [result] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(whereConditions)
    .limit(1);
  
  return !!result;
}

/**
 * Validate that APIs exist and belong to a user
 */
export async function validateUserApis(apiIds: number[], userId: number): Promise<number[]> {
  if (apiIds.length === 0) {
    return [];
  }

  const userApis = await db
    .select({ id: apis.id })
    .from(apis)
    .where(and(eq(apis.userId, userId), inArray(apis.id, apiIds)));

  return userApis.map(api => api.id);
}
