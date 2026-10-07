import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserProject: vi.fn(),
  updateProject: vi.fn(),
  isEnvironmentLinked: vi.fn(),
  listProjectEnvironments: vi.fn(),
  linkEnvironment: vi.fn(),
  getEnvironmentByIdAndUserId: vi.fn()
}));

vi.mock('../../repository/db/project.js', () => ({
  ProjectRepository: class {
    getUserProject = mocks.getUserProject;
    updateProject = mocks.updateProject;
  }
}));
vi.mock('../../repository/db/project_environment.js', () => ({
  ProjectEnvironmentRepository: class {
    isEnvironmentLinked = mocks.isEnvironmentLinked;
    listProjectEnvironments = mocks.listProjectEnvironments;
    linkEnvironment = mocks.linkEnvironment;
  }
}));
vi.mock('../../repository/db/environment.js', () => ({
  getEnvironmentByIdAndUserId: mocks.getEnvironmentByIdAndUserId
}));

import { ProjectEnvironmentMappingService } from './project_environment_mapping_service';
import { ProjectEnvironmentService } from './environment_service';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserProject.mockResolvedValue({ id: 7, projectJson: {} });
  mocks.isEnvironmentLinked.mockResolvedValue(false);
  mocks.listProjectEnvironments.mockResolvedValue({ environmentLinks: [], total: 0 });
});

describe.each([
  [
    'ProjectEnvironmentMappingService',
    (userId: number) => new ProjectEnvironmentMappingService().linkEnvironment(7, userId, 5, {})
  ],
  [
    'ProjectEnvironmentService',
    (userId: number) =>
      new ProjectEnvironmentService().linkEnvironment(7, userId, {
        environmentId: 5,
        variableMappings: {}
      })
  ]
])('%s.linkEnvironment', (_name, link) => {
  it('refuses an environment the user does not own', async () => {
    mocks.getEnvironmentByIdAndUserId.mockResolvedValue(null);
    await expect(link(1)).rejects.toThrow('Environment not found or access denied');
    expect(mocks.getEnvironmentByIdAndUserId).toHaveBeenCalledWith(5, 1);
    expect(mocks.linkEnvironment).not.toHaveBeenCalled();
  });

  it('refuses a second environment because a project has only one', async () => {
    mocks.getEnvironmentByIdAndUserId.mockResolvedValue({ id: 5 });
    mocks.listProjectEnvironments.mockResolvedValue({
      environmentLinks: [{ environmentId: 9 }],
      total: 1
    });
    await expect(link(1)).rejects.toThrow(/already linked to environment 9/);
    expect(mocks.linkEnvironment).not.toHaveBeenCalled();
  });

  it('links an environment the user owns', async () => {
    mocks.getEnvironmentByIdAndUserId.mockResolvedValue({ id: 5 });
    await link(1);
    expect(mocks.linkEnvironment).toHaveBeenCalled();
  });
});
