import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertServerRunUrlAllowed,
  ServerFlowHttpTransport
} from './server_flow_http_transport';

describe('ServerFlowHttpTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TEST_PILOT_ALLOW_PRIVATE_SERVER_RUNS;
  });

  it('blocks localhost and private hosts by default', () => {
    expect(() => assertServerRunUrlAllowed('http://localhost:3000/users')).toThrow(
      /private or localhost/
    );
    expect(() => assertServerRunUrlAllowed('http://127.0.0.1:3000/users')).toThrow(
      /private or localhost/
    );
    expect(() => assertServerRunUrlAllowed('http://10.0.0.5/users')).toThrow(
      /private or localhost/
    );
  });

  it('allows private hosts when explicitly configured', () => {
    process.env.TEST_PILOT_ALLOW_PRIVATE_SERVER_RUNS = 'true';
    expect(() => assertServerRunUrlAllowed('http://localhost:3000/users')).not.toThrow();
  });

  it('sends stored cookies and stores response cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=next; Path=/'
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const cookieStore = new Map([
      ['login-0', [{ name: 'session', value: 'old', domain: 'api.example.com' }]]
    ]);

    const transport = new ServerFlowHttpTransport();
    await transport.execute({
      endpointDef: { method: 'GET', path: '/users' },
      url: 'https://api.example.com/users',
      headers: { Accept: 'application/json' },
      body: null,
      timeout: 30000,
      cookieStore,
      endpointId: 'users-0',
      useServerCookieHandling: false,
      addLog: vi.fn()
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Cookie')).toBe('session=old');
    expect(cookieStore.get('users-0')).toEqual([
      { name: 'session', value: 'next', domain: 'api.example.com', path: '/' }
    ]);
  });
});
