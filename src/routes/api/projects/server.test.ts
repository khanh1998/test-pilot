import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET, POST } from './+server';

const { createProject, listUserProjects } = vi.hoisted(() => ({
  createProject: vi.fn(),
  listUserProjects: vi.fn()
}));
vi.mock('$lib/server/service/projects/project_service', () => ({
  ProjectService: class {
    createProject = createProject;
    listUserProjects = listUserProjects;
  }
}));

function event(body: string, authenticated = true, query = '') {
  return {
    request: new Request('http://localhost/api/projects', { method: 'POST', body }),
    url: new URL(`http://localhost/api/projects${query}`),
    locals: authenticated ? { user: { userId: 7 } } : {}
  } as RequestEvent;
}

describe('project route validation', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['{bad', '', 'null', '[]', '{"name":42}'])(
    'rejects invalid JSON payload %s without calling the service',
    async (body) => {
      const response = await POST(event(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty('error');
      expect(createProject).not.toHaveBeenCalled();
    }
  );
  it('checks authentication before reading the body', async () => {
    const response = await POST(event('{bad', false));
    expect(response.status).toBe(401);
    expect(createProject).not.toHaveBeenCalled();
  });
  it('passes validated data and the authenticated user to the service', async () => {
    createProject.mockResolvedValue({ id: 1, name: 'Example' });
    const response = await POST(event('{"name":"Example","apiIds":[2],"userId":99}'));
    expect(response.status).toBe(201);
    expect(createProject).toHaveBeenCalledWith(7, {
      name: 'Example',
      description: undefined,
      apiIds: [2]
    });
    expect(await response.json()).toEqual({ project: { id: 1, name: 'Example' } });
  });
  it('rejects invalid pagination instead of silently replacing it', async () => {
    const response = await GET(event('', true, '?limit=-1'));
    expect(response.status).toBe(400);
    expect(listUserProjects).not.toHaveBeenCalled();
  });
});
