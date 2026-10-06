import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { DELETE } from './+server';
const { unlinkEnvironment } = vi.hoisted(() => ({ unlinkEnvironment: vi.fn() }));
vi.mock('$lib/server/service/projects/environment_service', () => ({
  ProjectEnvironmentService: class {
    unlinkEnvironment = unlinkEnvironment;
  }
}));
it('reads the environment ID from the documented query on the plural endpoint', async () => {
  const response = await DELETE({
    params: { id: '2' },
    url: new URL('http://localhost/api/projects/2/environments?environmentId=3'),
    locals: { user: { userId: 7 } }
  } as unknown as RequestEvent);
  expect(response.status).toBe(200);
  expect(unlinkEnvironment).toHaveBeenCalledWith(2, 3, 7);
});
describe('missing environment ID', () => {
  it('returns 400', async () => {
    const response = await DELETE({
      params: { id: '2' },
      url: new URL('http://localhost/api/projects/2/environments'),
      locals: { user: { userId: 7 } }
    } as unknown as RequestEvent);
    expect(response.status).toBe(400);
  });
});
