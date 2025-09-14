import { db } from '$lib/server/db/index';
import { projectApis, apis } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export interface CreateProjectApiData {
  projectId: number;
  apiId: number;
  defaultHost?: string;
}

export interface UpdateProjectApiData {
  defaultHost?: string;
}

export async function createProjectApi(data: CreateProjectApiData) {
  const [projectApi] = await db
    .insert(projectApis)
    .values({
      projectId: data.projectId,
      apiId: data.apiId,
      defaultHost: data.defaultHost
    })
    .returning();

  return projectApi;
}

export async function getProjectApiById(id: number) {
  const [projectApi] = await db
    .select()
    .from(projectApis)
    .where(eq(projectApis.id, id));

  return projectApi;
}

export async function getProjectApiByIds(projectId: number, apiId: number) {
  const [projectApi] = await db
    .select()
    .from(projectApis)
    .where(and(
      eq(projectApis.projectId, projectId),
      eq(projectApis.apiId, apiId)
    ));

  return projectApi;
}

export async function getProjectApisByProjectId(projectId: number) {
  const projectApisList = await db
    .select({
      id: projectApis.id,
      projectId: projectApis.projectId,
      apiId: projectApis.apiId,
      defaultHost: projectApis.defaultHost,
      createdAt: projectApis.createdAt,
      api: {
        id: apis.id,
        name: apis.name,
        description: apis.description,
        host: apis.host
      }
    })
    .from(projectApis)
    .leftJoin(apis, eq(projectApis.apiId, apis.id))
    .where(eq(projectApis.projectId, projectId))
    .orderBy(projectApis.createdAt);

  return projectApisList;
}

export async function updateProjectApi(id: number, data: UpdateProjectApiData) {
  const [projectApi] = await db
    .update(projectApis)
    .set({
      defaultHost: data.defaultHost
    })
    .where(eq(projectApis.id, id))
    .returning();

  return projectApi;
}

export async function deleteProjectApi(id: number) {
  await db
    .delete(projectApis)
    .where(eq(projectApis.id, id));
}
