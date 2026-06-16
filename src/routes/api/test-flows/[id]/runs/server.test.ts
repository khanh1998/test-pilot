import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestFlowSync } from '$lib/server/service/test_flows/run_test_flow_sync';
import { POST } from './+server';

vi.mock('$lib/server/service/test_flows/run_test_flow_sync', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('$lib/server/service/test_flows/run_test_flow_sync')>();
  return {
    ...actual,
    runTestFlowSync: vi.fn()
  };
});

describe('POST /api/test-flows/[id]/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unsupported async mode', async () => {
    const response = await POST(
      createEvent({
        id: '1',
        body: { mode: 'async' },
        userId: 10
      })
    );

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ error: 'Async test flow runs are not implemented yet' });
  });

  it('rejects invalid flow ids', async () => {
    const response = await POST(createEvent({ id: 'abc', body: {}, userId: 10 }));

    expect(response.status).toBe(400);
  });

  it('rejects malformed JSON bodies', async () => {
    const response = await POST(createEvent({ id: '1', body: '{bad json', userId: 10 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Request body must be valid JSON' });
  });

  it('calls the sync run service for authenticated users', async () => {
    vi.mocked(runTestFlowSync).mockResolvedValue({
      status: 'completed',
      success: true,
      summary: 'ok',
      executionState: {},
      storedResponses: {},
      storedTransformations: {},
      parameterValues: {},
      flowOutputs: {},
      logs: []
    });

    const response = await POST(
      createEvent({
        id: '7',
        body: { parameters: { token: 'secret' } },
        userId: 10
      })
    );

    expect(response.status).toBe(200);
    expect(runTestFlowSync).toHaveBeenCalledWith(7, 10, {
      parameters: { token: 'secret' },
      environment: undefined,
      preferences: undefined
    });
  });

  it('rejects missing auth', async () => {
    const response = await POST(createEvent({ id: '1', body: {} }));

    expect(response.status).toBe(401);
  });
});

function createEvent(input: {
  id: string;
  body: Record<string, unknown> | string;
  userId?: number;
}): Parameters<typeof POST>[0] {
  return ({
    params: { id: input.id },
    request: new Request('http://localhost/api/test-flows/1/runs', {
      method: 'POST',
      body: typeof input.body === 'string' ? input.body : JSON.stringify(input.body)
    }),
    locals: input.userId ? { user: { userId: input.userId, email: 'user@example.com' } } : {}
  } as unknown) as Parameters<typeof POST>[0];
}
