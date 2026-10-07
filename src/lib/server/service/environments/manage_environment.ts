/**
 * Environment management for agents: merge-style edits, ownership checks and safe deletion.
 */

import * as apiRepo from '$lib/server/repository/db/apis';
import * as environmentRepo from '$lib/server/repository/db/environment';
import { ProjectEnvironmentRepository } from '$lib/server/repository/db/project_environment';
import { assertNoOtherEnvironmentLinked } from '$lib/server/service/projects/assert_single_environment';
import { ProjectEnvironmentMappingService } from '$lib/server/service/projects/project_environment_mapping_service';
import {
  createEnvironment,
  EnvironmentCreationError,
  validateEnvironmentConfig
} from './create_environment';
import { deleteEnvironment } from './delete_environment';
import { getEnvironmentForUser } from './get_environments';
import { EnvironmentUpdateError, updateEnvironment } from './update_environment';
import type {
  Environment,
  EnvironmentConfig,
  SubEnvironment,
  VariableDefinition
} from '$lib/types/environment';

export class EnvironmentManagementError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'IN_USE' | 'INVALID',
    /** For IN_USE: whether retrying with force can resolve it. */
    public readonly forceable = false
  ) {
    super(message);
    this.name = 'EnvironmentManagementError';
  }
}

export interface SubEnvironmentInput {
  name?: string;
  description?: string;
  variables?: Record<string, unknown>;
  apiHosts?: Record<string, string>;
}

export interface VariableDefinitionInput {
  type: VariableDefinition['type'];
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

/** Agent-friendly shape; convert with buildEnvironmentConfig. */
export interface CreateManagedEnvironmentInput {
  name: string;
  description?: string;
  type?: EnvironmentConfig['type'];
  subEnvironments?: Record<string, SubEnvironmentInput>;
  variableDefinitions?: Record<string, VariableDefinitionInput>;
  linkedApiIds?: number[];
  projectId?: number;
  variableMappings?: Record<string, string>;
}

/** `null` removes a key; any other value is merged in. */
export interface PatchManagedEnvironmentInput {
  name?: string;
  description?: string | null;
  linkedApiIds?: number[];
  variableDefinitions?: Record<string, VariableDefinitionInput | null>;
  subEnvironments?: Record<
    string,
    | (Omit<SubEnvironmentInput, 'variables' | 'apiHosts'> & {
        variables?: Record<string, unknown>;
        apiHosts?: Record<string, string | null>;
      } & { removeVariables?: string[] })
    | null
  >;
}

export function summarizeEnvironment(environment: Environment, includeValues: boolean) {
  const config = environment.config;
  return {
    id: environment.id,
    name: environment.name,
    description: environment.description ?? null,
    type: config.type,
    linkedApiIds: config.linked_apis ?? [],
    variableDefinitions: config.variable_definitions ?? {},
    subEnvironments: Object.fromEntries(
      Object.entries(config.environments ?? {}).map(([key, sub]) => [
        key,
        includeValues
          ? {
              name: sub.name,
              description: sub.description ?? null,
              variables: sub.variables ?? {},
              apiHosts: sub.api_hosts ?? {}
            }
          : {
              name: sub.name,
              description: sub.description ?? null,
              variableNames: Object.keys(sub.variables ?? {}),
              apiHostApiIds: Object.keys(sub.api_hosts ?? {})
            }
      ])
    ),
    updatedAt: environment.updatedAt
  };
}

export async function getManagedEnvironment(environmentId: number, userId: number) {
  const environment = await getEnvironmentForUser(environmentId, userId);
  if (!environment) {
    throw new EnvironmentManagementError('Environment not found or access denied', 'NOT_FOUND');
  }
  return environment;
}

export interface CreateManagedEnvironmentParams {
  name: string;
  description?: string;
  config: EnvironmentConfig;
  /** Link the new environment to this project right away. */
  projectId?: number;
  variableMappings?: Record<string, string>;
}

export async function createManagedEnvironment(
  userId: number,
  params: CreateManagedEnvironmentParams
): Promise<Environment> {
  const { config, projectId, variableMappings } = params;
  await assertApisOwned(userId, referencedApiIds(config));

  const mappingService = new ProjectEnvironmentMappingService();
  if (projectId !== undefined) {
    // Fail before creating anything if the project is not accessible or already has an environment.
    await mappingService.getEnvironmentMappings(projectId, userId);
    await assertNoOtherEnvironmentLinked(projectId, null);
  }

  let environment: Environment;
  try {
    environment = await createEnvironment(userId, {
      name: params.name.trim(),
      description: params.description?.trim() || undefined,
      config
    });
  } catch (error) {
    if (error instanceof EnvironmentCreationError) {
      throw new EnvironmentManagementError(error.message, 'INVALID');
    }
    throw error;
  }

  if (projectId !== undefined) {
    await mappingService.linkEnvironment(projectId, userId, environment.id, variableMappings ?? {});
  }
  return getManagedEnvironment(environment.id, userId);
}

export interface UpdateManagedEnvironmentParams {
  name?: string;
  description?: string;
  /** Replaces the stored configuration. */
  config?: EnvironmentConfig;
}

export async function updateManagedEnvironment(
  environmentId: number,
  userId: number,
  params: UpdateManagedEnvironmentParams
): Promise<Environment> {
  await getManagedEnvironment(environmentId, userId);

  if (params.config) {
    await assertApisOwned(userId, referencedApiIds(params.config));
    try {
      validateEnvironmentConfig(params.config);
    } catch (error) {
      throw new EnvironmentManagementError(
        error instanceof Error ? error.message : 'Invalid environment configuration',
        'INVALID'
      );
    }
  }

  let updated: Environment | null;
  try {
    updated = await updateEnvironment(environmentId, userId, {
      ...params,
      name: params.name?.trim()
    });
  } catch (error) {
    if (error instanceof EnvironmentUpdateError) {
      throw new EnvironmentManagementError(error.message, 'INVALID');
    }
    throw error;
  }
  if (!updated) {
    throw new EnvironmentManagementError('Environment not found or access denied', 'NOT_FOUND');
  }
  return updated;
}

/** Merge-style edit: loads the environment, applies the patch, and saves via updateManagedEnvironment. */
export async function patchManagedEnvironment(
  environmentId: number,
  userId: number,
  patch: PatchManagedEnvironmentInput
): Promise<Environment> {
  if (Object.keys(patch).length === 0) {
    throw new EnvironmentManagementError('Provide at least one field to update', 'INVALID');
  }
  const current = await getManagedEnvironment(environmentId, userId);

  return updateManagedEnvironment(environmentId, userId, {
    name: patch.name,
    description: patch.description === undefined ? undefined : (patch.description ?? ''),
    config: applyEnvironmentPatch(current.config, patch)
  });
}

/** Convert the agent-friendly input shape into the stored environment configuration. */
export function buildEnvironmentConfig(
  input: Pick<
    CreateManagedEnvironmentInput,
    'type' | 'subEnvironments' | 'variableDefinitions' | 'linkedApiIds'
  >
): EnvironmentConfig {
  return {
    type: input.type ?? 'environment_set',
    environments: Object.fromEntries(
      Object.entries(input.subEnvironments ?? {}).map(([key, sub]) => [
        key,
        toSubEnvironment(key, sub)
      ])
    ),
    variable_definitions: Object.fromEntries(
      Object.entries(input.variableDefinitions ?? {}).map(([key, def]) => [
        key,
        toVariableDefinition(def)
      ])
    ),
    linked_apis: input.linkedApiIds ?? []
  };
}

/** Apply a merge-style patch to an environment configuration without mutating the original. */
export function applyEnvironmentPatch(
  current: EnvironmentConfig,
  patch: PatchManagedEnvironmentInput
): EnvironmentConfig {
  const config = structuredClone(current);
  config.environments ??= {};
  config.variable_definitions ??= {};

  for (const [key, def] of Object.entries(patch.variableDefinitions ?? {})) {
    if (def === null) delete config.variable_definitions[key];
    else config.variable_definitions[key] = toVariableDefinition(def);
  }

  for (const [key, sub] of Object.entries(patch.subEnvironments ?? {})) {
    if (sub === null) {
      delete config.environments[key];
      continue;
    }
    const existing: SubEnvironment = config.environments[key] ?? toSubEnvironment(key, {});
    const variables = { ...existing.variables, ...(sub.variables ?? {}) };
    for (const name of sub.removeVariables ?? []) delete variables[name];
    const apiHosts = { ...existing.api_hosts };
    for (const [apiId, host] of Object.entries(sub.apiHosts ?? {})) {
      if (host === null) delete apiHosts[apiId];
      else apiHosts[apiId] = host;
    }
    config.environments[key] = {
      name: sub.name ?? existing.name,
      description: sub.description ?? existing.description,
      variables,
      api_hosts: apiHosts
    };
  }

  if (patch.linkedApiIds !== undefined) config.linked_apis = patch.linkedApiIds;
  return config;
}

export async function deleteManagedEnvironment(
  environmentId: number,
  userId: number,
  force = false
) {
  const environment = await getManagedEnvironment(environmentId, userId);

  // Flows keep a hard reference to their environment, so they must be re-linked or removed first.
  const flows = await environmentRepo.getFlowsUsingEnvironment(environmentId, userId);
  if (flows.length > 0) {
    throw new EnvironmentManagementError(
      `Environment is linked to ${flows.length} test flow${flows.length === 1 ? '' : 's'}: ${flows
        .map((flow) => `${flow.name} (id ${flow.id})`)
        .join(', ')}. Link those flows to another environment first.`,
      'IN_USE',
      false
    );
  }

  const projectIds = await environmentRepo.getLinkedProjectIds(environmentId);
  if (projectIds.length > 0 && !force) {
    throw new EnvironmentManagementError(
      `Environment is still linked to project${projectIds.length === 1 ? '' : 's'} ${projectIds.join(', ')}. Deleting it will unlink it from ${projectIds.length === 1 ? 'that project' : 'those projects'}.`,
      'IN_USE',
      true
    );
  }

  const mappingService = new ProjectEnvironmentMappingService();
  for (const projectId of projectIds) {
    await mappingService.unlinkEnvironment(projectId, userId, environmentId);
  }
  await deleteEnvironment(environmentId, userId);
  return { environmentId, name: environment.name, unlinkedProjectIds: projectIds };
}

/** Link an environment to a project, or replace the variable mappings if already linked. */
export async function linkManagedEnvironmentToProject(
  projectId: number,
  userId: number,
  environmentId: number,
  variableMappings: Record<string, string>
) {
  const mappingService = new ProjectEnvironmentMappingService();
  // Ownership of the project is verified by the mapping service calls below.
  await mappingService.getEnvironmentMappings(projectId, userId);
  const existing = await new ProjectEnvironmentRepository().isEnvironmentLinked(
    projectId,
    environmentId
  );
  if (existing) {
    await mappingService.updateEnvironmentMapping(
      projectId,
      userId,
      environmentId,
      variableMappings
    );
  } else {
    await mappingService.linkEnvironment(projectId, userId, environmentId, variableMappings);
  }
  return { projectId, environmentId, variableMappings, alreadyLinked: Boolean(existing) };
}

function toSubEnvironment(key: string, sub: SubEnvironmentInput): SubEnvironment {
  return {
    name: sub.name ?? key,
    description: sub.description,
    variables: sub.variables ?? {},
    api_hosts: sub.apiHosts ?? {}
  };
}

function toVariableDefinition(def: VariableDefinitionInput): VariableDefinition {
  return {
    type: def.type,
    description: def.description,
    required: def.required ?? false,
    default_value: def.defaultValue ?? null
  };
}

function referencedApiIds(config: EnvironmentConfig): number[] {
  return [
    ...(config.linked_apis ?? []),
    ...Object.values(config.environments ?? {}).flatMap((sub) =>
      Object.keys(sub.api_hosts ?? {}).map(Number)
    )
  ];
}

async function assertApisOwned(userId: number, apiIds: number[]) {
  for (const apiId of new Set(apiIds)) {
    if (!Number.isInteger(apiId) || !(await apiRepo.getApiById(apiId, userId))) {
      throw new EnvironmentManagementError(`API ${apiId} not found or access denied`, 'INVALID');
    }
  }
}
