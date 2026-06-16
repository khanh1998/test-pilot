import { describe, expect, it, vi, beforeEach } from 'vitest';

const authMocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  authenticateToken: vi.fn()
}));

vi.mock('$lib/server/middleware/auth', () => ({
  verifyToken: authMocks.verifyToken
}));

vi.mock('$lib/server/service/agents/agent_token_service', () => ({
  AgentTokenService: vi.fn().mockImplementation(() => ({
    authenticateToken: authMocks.authenticateToken
  }))
}));

const { handle } = await import('./hooks.server');

describe('hooks auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows agent tokens for sync test flow run API', async () => {
    authMocks.verifyToken.mockReturnValue(null);
    authMocks.authenticateToken.mockResolvedValue({
      tokenId: 5,
      userId: 10,
      email: 'agent@example.com',
      name: 'Agent'
    });

    const event = createEvent('/api/test-flows/7/runs', 'POST');
    const response = await handle({
      event,
      resolve: vi.fn().mockResolvedValue(new Response('ok'))
    } as any);

    expect(response.status).toBe(200);
    expect((event.locals as App.Locals).user).toEqual({
      userId: 10,
      email: 'agent@example.com',
      name: 'Agent'
    });
    expect((event.locals as App.Locals).authSource).toBe('agent_token');
    expect((event.locals as App.Locals).agentTokenId).toBe(5);
  });

  it('does not allow agent-token fallback for unrelated API routes', async () => {
    authMocks.verifyToken.mockReturnValue(null);

    await expect(
      handle({
        event: createEvent('/api/test-flows', 'GET'),
        resolve: vi.fn().mockResolvedValue(new Response('ok'))
      } as any)
    ).rejects.toMatchObject({ status: 401 });

    expect(authMocks.authenticateToken).not.toHaveBeenCalled();
  });
});

function createEvent(pathname: string, method: string) {
  return {
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`, {
      method,
      headers: { Authorization: 'Bearer token' }
    }),
    locals: {}
  };
}
