import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserFlowHttpTransport } from './browser-http-transport';
import { executeDirectEndpoint, executeProxiedEndpoint } from '$lib/http_client/test-flow';

vi.mock('$lib/environment', () => ({
  isDesktop: false
}));

vi.mock('$lib/http_client/test-flow', () => ({
  executeDirectEndpoint: vi.fn(),
  executeProxiedEndpoint: vi.fn()
}));

describe('BrowserFlowHttpTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates direct requests to the existing frontend direct executor', async () => {
    const response = new Response('ok');
    vi.mocked(executeDirectEndpoint).mockResolvedValue(response);

    const transport = new BrowserFlowHttpTransport();
    const result = await transport.execute({
      endpointDef: { method: 'GET', path: '/users' },
      url: 'https://api.example.com/users',
      headers: {},
      body: null,
      timeout: 30000,
      cookieStore: new Map(),
      endpointId: 'users-0',
      useServerCookieHandling: false,
      addLog: vi.fn()
    });

    expect(result).toBe(response);
    expect(executeDirectEndpoint).toHaveBeenCalledWith(
      { method: 'GET', path: '/users' },
      'https://api.example.com/users',
      {},
      null,
      30000,
      expect.any(Map),
      'users-0'
    );
  });

  it('delegates proxied requests and stores returned cookies', async () => {
    vi.mocked(executeProxiedEndpoint).mockResolvedValue({
      response: new Response('ok'),
      cookies: [{ name: 'session', value: 'next', domain: 'api.example.com' }]
    });
    const cookieStore = new Map();

    const transport = new BrowserFlowHttpTransport();
    await transport.execute({
      endpointDef: { method: 'GET', path: '/users' },
      url: 'https://api.example.com/users',
      headers: {},
      body: null,
      timeout: 30000,
      cookieStore,
      endpointId: 'users-0',
      useServerCookieHandling: true,
      addLog: vi.fn()
    });

    expect(executeProxiedEndpoint).toHaveBeenCalled();
    expect(cookieStore.get('users-0')).toEqual([
      { name: 'session', value: 'next', domain: 'api.example.com', path: undefined }
    ]);
  });
});
