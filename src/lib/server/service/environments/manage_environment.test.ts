import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '$lib/types/environment';

const mocks = vi.hoisted(() => ({
  getEnvironmentForUser: vi.fn(),
  updateEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  getApiById: vi.fn(),
  getFlowsUsingEnvironment: vi.fn(),
  getLinkedProjectIds: vi.fn(),
  unlinkEnvironment: vi.fn(),
  isEnvironmentLinked: vi.fn(),
  listProjectEnvironments: vi.fn(),
  getEnvironmentMappings: vi.fn(),
  linkEnvironment: vi.fn(),
  updateEnvironmentMapping: vi.fn()
}));

vi.mock('./get_environments', () => ({ getEnvironmentForUser: mocks.getEnvironmentForUser }));
vi.mock('./update_environment', async (importOriginal) => {
  const original = await importOriginal<typeof import('./update_environment')>();
  return { ...original, updateEnvironment: mocks.updateEnvironment };
});
vi.mock('./delete_environment', () => ({ deleteEnvironment: mocks.deleteEnvironment }));
vi.mock('./create_environment', async (importOriginal) => {
  const original = await importOriginal<typeof import('./create_environment')>();
  return { ...original, createEnvironment: vi.fn() };
});
vi.mock('$lib/server/repository/db/apis', () => ({ getApiById: mocks.getApiById }));
vi.mock('$lib/server/repository/db/environment', () => ({
  getEnvironmentsByUserId: vi.fn(),
  getFlowsUsingEnvironment: mocks.getFlowsUsingEnvironment,
  getLinkedProjectIds: mocks.getLinkedProjectIds
}));
vi.mock('$lib/server/repository/db/project_environment', () => ({
  ProjectEnvironmentRepository: class {
    isEnvironmentLinked = mocks.isEnvironmentLinked;
    listProjectEnvironments = mocks.listProjectEnvironments;
  }
}));
vi.mock('$lib/server/service/projects/project_environment_mapping_service', () => ({
  ProjectEnvironmentMappingService: class {
    getEnvironmentMappings = mocks.getEnvironmentMappings;
    linkEnvironment = mocks.linkEnvironment;
    updateEnvironmentMapping = mocks.updateEnvironmentMapping;
    unlinkEnvironment = mocks.unlinkEnvironment;
  }
}));

import { createEnvironment, EnvironmentValidationError } from './create_environment';
import { EnvironmentUpdateError } from './update_environment';
import {
  buildEnvironmentConfig,
  createManagedEnvironment,
  deleteManagedEnvironment,
  EnvironmentManagementError,
  linkManagedEnvironmentToProject,
  patchManagedEnvironment,
  updateManagedEnvironment
} from './manage_environment';

function environment(): Environment {
  return {
    id: 5,
    name: 'Hero',
    description: 'desc',
    userId: 1,
    createdAt: '',
    updatedAt: '',
    config: {
      type: 'environment_set',
      linked_apis: [10],
      variable_definitions: {
        username: { type: 'string', required: true, default_value: null }
      },
      environments: {
        dev: {
          name: 'Development',
          variables: { username: 'dev-user', token: 'abc' },
          api_hosts: { '10': 'https://dev.example.com' }
        },
        uat: { name: 'UAT', variables: {}, api_hosts: {} }
      }
    }
  } as Environment;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getEnvironmentForUser.mockImplementation(async () => environment());
  mocks.updateEnvironment.mockImplementation(async () => environment());
  mocks.getApiById.mockResolvedValue({ id: 10 });
  mocks.listProjectEnvironments.mockResolvedValue({ environmentLinks: [], total: 0 });
});

function savedConfig() {
  return mocks.updateEnvironment.mock.calls[0][2].config;
}

describe('patchManagedEnvironment', () => {
  it('merges variables and hosts into one sub-environment without touching the others', async () => {
    await patchManagedEnvironment(5, 1, {
      subEnvironments: {
        dev: {
          variables: { password: 'secret' },
          removeVariables: ['token'],
          apiHosts: { '10': 'https://dev2.example.com' }
        }
      }
    });

    const config = savedConfig();
    expect(config.environments.dev).toEqual({
      name: 'Development',
      description: undefined,
      variables: { username: 'dev-user', password: 'secret' },
      api_hosts: { '10': 'https://dev2.example.com' }
    });
    expect(config.environments.uat.name).toBe('UAT');
  });

  it('removes a sub-environment, host entry, and variable definition with null', async () => {
    await patchManagedEnvironment(5, 1, {
      subEnvironments: { uat: null, dev: { apiHosts: { '10': null } } },
      variableDefinitions: { username: null }
    });

    const config = savedConfig();
    expect(config.environments.uat).toBeUndefined();
    expect(config.environments.dev.api_hosts).toEqual({});
    expect(config.variable_definitions).toEqual({});
  });

  it('adds a new sub-environment named after its key', async () => {
    await patchManagedEnvironment(5, 1, {
      subEnvironments: { sit: { variables: { username: 'sit-user' } } }
    });

    expect(savedConfig().environments.sit).toMatchObject({
      name: 'sit',
      variables: { username: 'sit-user' }
    });
  });

  it('rejects an invalid host URL and does not save', async () => {
    await expect(
      patchManagedEnvironment(5, 1, {
        subEnvironments: { dev: { apiHosts: { '10': 'not a url' } } }
      })
    ).rejects.toMatchObject({ code: 'INVALID' });
    expect(mocks.updateEnvironment).not.toHaveBeenCalled();
  });

  it('rejects hosts or linked APIs the user does not own', async () => {
    mocks.getApiById.mockResolvedValue(null);
    await expect(patchManagedEnvironment(5, 1, { linkedApiIds: [99] })).rejects.toMatchObject({
      code: 'INVALID'
    });
    expect(mocks.updateEnvironment).not.toHaveBeenCalled();
  });

  it('reports a missing environment and an empty patch', async () => {
    mocks.getEnvironmentForUser.mockResolvedValue(null);
    await expect(patchManagedEnvironment(5, 1, { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });

    mocks.getEnvironmentForUser.mockImplementation(async () => environment());
    await expect(patchManagedEnvironment(5, 1, {})).rejects.toBeInstanceOf(
      EnvironmentManagementError
    );
  });
});

describe('deleteManagedEnvironment', () => {
  it('blocks deletion while test flows use the environment, even with force', async () => {
    mocks.getFlowsUsingEnvironment.mockResolvedValue([{ id: 3, name: 'Login flow' }]);
    await expect(deleteManagedEnvironment(5, 1, true)).rejects.toThrow(/Login flow \(id 3\)/);
    expect(mocks.deleteEnvironment).not.toHaveBeenCalled();
  });

  it('blocks deletion while linked to projects unless forced', async () => {
    mocks.getFlowsUsingEnvironment.mockResolvedValue([]);
    mocks.getLinkedProjectIds.mockResolvedValue([7]);
    await expect(deleteManagedEnvironment(5, 1)).rejects.toMatchObject({ code: 'IN_USE' });

    await deleteManagedEnvironment(5, 1, true);
    expect(mocks.unlinkEnvironment).toHaveBeenCalledWith(7, 1, 5);
    expect(mocks.deleteEnvironment).toHaveBeenCalledWith(5, 1);
  });
});

describe('linkManagedEnvironmentToProject', () => {
  it('links when not yet linked and replaces mappings when already linked', async () => {
    mocks.isEnvironmentLinked.mockResolvedValue(false);
    await linkManagedEnvironmentToProject(7, 1, 5, { user: 'username' });
    expect(mocks.linkEnvironment).toHaveBeenCalledWith(7, 1, 5, { user: 'username' });

    mocks.isEnvironmentLinked.mockResolvedValue(true);
    const result = await linkManagedEnvironmentToProject(7, 1, 5, { user: 'token' });
    expect(mocks.updateEnvironmentMapping).toHaveBeenCalledWith(7, 1, 5, { user: 'token' });
    expect(result.alreadyLinked).toBe(true);
  });
});

describe('createManagedEnvironment', () => {
  const config = () => environment().config;

  beforeEach(() => {
    vi.mocked(createEnvironment).mockResolvedValue(environment());
  });

  it('rejects APIs the user does not own before creating anything', async () => {
    mocks.getApiById.mockResolvedValue(null);
    await expect(
      createManagedEnvironment(1, { name: 'Hero', config: config() })
    ).rejects.toMatchObject({ code: 'INVALID' });
    expect(createEnvironment).not.toHaveBeenCalled();
  });

  it('maps creation validation errors to INVALID', async () => {
    vi.mocked(createEnvironment).mockRejectedValue(
      new EnvironmentValidationError('bad name', 'name')
    );
    await expect(
      createManagedEnvironment(1, { name: 'Hero', config: config() })
    ).rejects.toMatchObject({ code: 'INVALID', message: 'bad name' });
  });

  it('does not create an environment for a project that already has one', async () => {
    mocks.listProjectEnvironments.mockResolvedValue({
      environmentLinks: [{ environmentId: 9 }],
      total: 1
    });
    await expect(
      createManagedEnvironment(1, { name: 'Hero', config: config(), projectId: 7 })
    ).rejects.toThrow(/only one environment/);
    expect(createEnvironment).not.toHaveBeenCalled();
  });

  it('creates and links to the project when projectId is given', async () => {
    await createManagedEnvironment(1, {
      name: ' Hero ',
      config: config(),
      projectId: 7,
      variableMappings: { user: 'username' }
    });
    expect(createEnvironment).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Hero' }));
    expect(mocks.getEnvironmentMappings).toHaveBeenCalledWith(7, 1);
    expect(mocks.linkEnvironment).toHaveBeenCalledWith(7, 1, 5, { user: 'username' });
  });
});

describe('updateManagedEnvironment', () => {
  it('maps duplicate-name errors to INVALID', async () => {
    mocks.updateEnvironment.mockRejectedValue(new EnvironmentUpdateError('dup', 'DUPLICATE_NAME'));
    await expect(updateManagedEnvironment(5, 1, { name: 'x' })).rejects.toMatchObject({
      code: 'INVALID'
    });
  });

  it('validates a replacement config the same way a patch does', async () => {
    const config = environment().config;
    config.environments.dev.api_hosts = { '10': 'nope' };
    await expect(updateManagedEnvironment(5, 1, { config })).rejects.toMatchObject({
      code: 'INVALID'
    });
    expect(mocks.updateEnvironment).not.toHaveBeenCalled();
  });
});

describe('buildEnvironmentConfig', () => {
  it('fills defaults from the agent-friendly shape', () => {
    expect(
      buildEnvironmentConfig({
        subEnvironments: { dev: { variables: { a: 1 } } },
        variableDefinitions: { a: { type: 'number' } }
      })
    ).toEqual({
      type: 'environment_set',
      environments: {
        dev: { name: 'dev', description: undefined, variables: { a: 1 }, api_hosts: {} }
      },
      variable_definitions: {
        a: { type: 'number', description: undefined, required: false, default_value: null }
      },
      linked_apis: []
    });
  });
});

describe('deleteManagedEnvironment forceable flag', () => {
  it('is false for flow blocks and true for project blocks', async () => {
    mocks.getFlowsUsingEnvironment.mockResolvedValue([{ id: 3, name: 'F' }]);
    await expect(deleteManagedEnvironment(5, 1)).rejects.toMatchObject({ forceable: false });

    mocks.getFlowsUsingEnvironment.mockResolvedValue([]);
    mocks.getLinkedProjectIds.mockResolvedValue([7]);
    await expect(deleteManagedEnvironment(5, 1)).rejects.toMatchObject({ forceable: true });
  });
});
