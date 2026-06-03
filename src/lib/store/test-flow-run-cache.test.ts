import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFlowSignature,
  loadRunSnapshot,
  sanitizeExecutionState,
  saveRunSnapshot
} from './test-flow-run-cache';
import type { ExecutionState, TestFlowData } from '$lib/components/test-flows/types';

const flowData: TestFlowData = {
  settings: {
    api_hosts: {
      1: { url: 'https://api.example.com' }
    },
    environment: {
      environmentId: 1,
      subEnvironment: 'dev'
    }
  },
  parameters: [],
  outputs: [],
  steps: [
    {
      step_id: 'step-1',
      label: 'Step 1',
      endpoints: [
        {
          endpoint_id: 1,
          api_id: 1,
          headers: [{ name: 'Authorization', value: 'Bearer token', enabled: true }]
        }
      ]
    }
  ]
};

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key))
    }
  });
}

describe('test flow run cache', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installLocalStorageMock();
  });

  it('saves and loads successful snapshots for unchanged flow data', () => {
    const executionState = {
      'step-1-0': {
        status: 'completed',
        request: {
          url: 'https://api.example.com/users',
          method: 'GET',
          headers: {
            Authorization: 'Bearer secret',
            Accept: 'application/json'
          }
        },
        response: {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'session=secret'
          },
          body: { id: 1 }
        },
        transformations: { userId: 1 }
      },
      progress: 100,
      currentStep: 0
    } as ExecutionState;

    expect(
      saveRunSnapshot({
        testFlowId: 123,
        flowData,
        executionState,
        parameterValues: { userId: 1 },
        flowOutputs: { createdUserId: 1 }
      })
    ).toBe(true);

    const snapshot = loadRunSnapshot(123, flowData);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.executionState['step-1-0']?.response?.body).toEqual({ id: 1 });
    expect(snapshot?.executionState['step-1-0']?.request?.headers?.Authorization).toBe(
      '[redacted]'
    );
    expect(snapshot?.executionState['step-1-0']?.response?.headers?.['set-cookie']).toBe(
      '[redacted]'
    );
    expect(snapshot?.flowOutputs).toEqual({ createdUserId: 1 });
  });

  it('ignores snapshots when the flow signature no longer matches', () => {
    saveRunSnapshot({
      testFlowId: 123,
      flowData,
      executionState: {},
      parameterValues: {}
    });

    const changedFlowData: TestFlowData = {
      ...flowData,
      steps: [...flowData.steps, { step_id: 'step-2', label: 'Step 2', endpoints: [] }]
    };

    expect(loadRunSnapshot(123, changedFlowData)).toBeNull();
  });

  it('creates stable signatures regardless of object key insertion order', () => {
    const reorderedFlowData: TestFlowData = {
      ...flowData,
      settings: {
        environment: flowData.settings.environment,
        api_hosts: flowData.settings.api_hosts
      }
    };

    expect(createFlowSignature(reorderedFlowData)).toBe(createFlowSignature(flowData));
  });

  it('redacts sensitive request and response headers from execution state', () => {
    const sanitized = sanitizeExecutionState({
      'step-1-0': {
        request: {
          headers: {
            authorization: 'Bearer secret',
            Cookie: 'session=secret',
            Accept: 'application/json'
          }
        },
        response: {
          headers: {
            'Set-Cookie': 'session=secret',
            'Content-Type': 'application/json'
          }
        }
      }
    });

    expect(sanitized['step-1-0']?.request?.headers?.authorization).toBe('[redacted]');
    expect(sanitized['step-1-0']?.request?.headers?.Cookie).toBe('[redacted]');
    expect(sanitized['step-1-0']?.request?.headers?.Accept).toBe('application/json');
    expect(sanitized['step-1-0']?.response?.headers?.['Set-Cookie']).toBe('[redacted]');
    expect(sanitized['step-1-0']?.response?.headers?.['Content-Type']).toBe('application/json');
  });
});
