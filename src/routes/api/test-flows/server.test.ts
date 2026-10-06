import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET, POST } from './+server';
import { TestFlowListResponse } from '$lib/schemas/test-flows';

const { getUserTestFlows, createBasicTestFlow } = vi.hoisted(() => ({
  getUserTestFlows: vi.fn(),
  createBasicTestFlow: vi.fn()
}));
vi.mock('$lib/server/repository/db/test-flows', () => ({ getUserTestFlows }));
vi.mock('$lib/server/service/test_flows/create_test_flow', () => ({ createBasicTestFlow }));
vi.mock('$lib/server/service/test_flows/delete_test_flow', () => ({ deleteTestFlow: vi.fn() }));

function event(body = '') {
  return {
    url: new URL('http://localhost/api/test-flows'),
    locals: { user: { userId: 7 } },
    request: new Request('http://localhost/api/test-flows', { method: 'POST', body })
  } as RequestEvent;
}

describe('test-flow route contracts', () => {
  it('validates the real list service output against the documented response', async () => {
    getUserTestFlows.mockResolvedValue({
      total: 1,
      testFlows: [
        {
          id: 1,
          name: 'Flow',
          description: null,
          createdAt: new Date('2026-06-17'),
          updatedAt: new Date('2026-06-17')
        }
      ]
    });
    const response = await GET(event());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(TestFlowListResponse.parse(body)).toEqual(body);
    expect(getUserTestFlows).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });
  it('accepts the default persisted flow shape without inventing required parameters', async () => {
    const flowJson = { steps: [], settings: { api_hosts: {} } };
    createBasicTestFlow.mockResolvedValue({ testFlow: { id: 1, flowJson } });
    const response = await POST(event(JSON.stringify({ name: 'Flow', apiIds: [2], flowJson })));
    expect(response.status).toBe(200);
    expect(createBasicTestFlow).toHaveBeenCalledWith(7, { name: 'Flow', apiIds: [2], flowJson });
  });
});
