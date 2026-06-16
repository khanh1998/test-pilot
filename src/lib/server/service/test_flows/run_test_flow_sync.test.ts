import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestFlowSync } from './run_test_flow_sync';
import { serverFlowHttpTransport } from './server_flow_http_transport';

vi.mock('./get_test_flow', () => ({
  getTestFlow: vi.fn()
}));

vi.mock('$lib/server/repository/db/environment', () => ({
  getEnvironmentByIdAndUserId: vi.fn()
}));

vi.mock('./server_flow_http_transport', () => ({
  serverFlowHttpTransport: {
    execute: vi.fn()
  }
}));

const { getTestFlow } = await import('./get_test_flow');

describe('runTestFlowSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full execution details with sensitive headers redacted', async () => {
    vi.mocked(getTestFlow).mockResolvedValue({
      testFlow: {
        id: 1,
        name: 'User flow',
        description: null,
        userId: 10,
        projectId: null,
        environmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        apis: [],
        endpoints: [
          {
            id: 100,
            apiId: 1,
            path: '/users',
            method: 'POST'
          }
        ],
        flowJson: {
          settings: {
            api_hosts: {
              1: { url: 'https://api.example.com', name: 'API' }
            },
            environment: { environmentId: null, subEnvironment: null }
          },
          parameters: [],
          outputs: [],
          steps: [
            {
              step_id: 'create-user',
              label: 'Create user',
              endpoints: [
                {
                  endpoint_id: 100,
                  api_id: 1,
                  headers: [
                    { name: 'Authorization', value: 'Bearer secret', enabled: true },
                    { name: 'Accept', value: 'application/json', enabled: true }
                  ],
                  body: { name: 'Ada' }
                }
              ]
            }
          ]
        }
      }
    } as any);

    vi.mocked(serverFlowHttpTransport.execute).mockResolvedValue(
      new Response(JSON.stringify({ id: 123 }), {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=secret'
        }
      })
    );

    const result = await runTestFlowSync(1, 10);
    const endpointState = result.executionState['create-user-0'];

    expect(result.status).toBe('completed');
    expect(result.success).toBe(true);
    expect(endpointState?.request?.url).toBe('https://api.example.com/users');
    expect(endpointState?.request?.method).toBe('POST');
    expect(endpointState?.request?.body).toEqual({ name: 'Ada' });
    expect(endpointState?.request?.headers?.Authorization).toBe('[redacted]');
    expect(endpointState?.request?.headers?.Accept).toBe('application/json');
    expect(endpointState?.response?.status).toBe(200);
    expect(endpointState?.response?.body).toEqual({ id: 123 });
    expect(endpointState?.response?.headers?.['set-cookie']).toBe('[redacted]');
    expect(result.storedResponses['create-user-0']).toEqual({ id: 123 });
  });

  it('returns missing parameters without executing requests', async () => {
    vi.mocked(getTestFlow).mockResolvedValue({
      testFlow: {
        id: 1,
        name: 'User flow',
        description: null,
        userId: 10,
        projectId: null,
        environmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        apis: [],
        endpoints: [],
        flowJson: {
          settings: {
            api_hosts: {
              1: { url: 'https://api.example.com', name: 'API' }
            }
          },
          parameters: [{ name: 'token', type: 'string', required: true }],
          outputs: [],
          steps: []
        }
      }
    } as any);

    const result = await runTestFlowSync(1, 10);

    expect(result.status).toBe('missing_parameters');
    expect(result.missingParameters).toEqual(['token']);
    expect(serverFlowHttpTransport.execute).not.toHaveBeenCalled();
  });
});
