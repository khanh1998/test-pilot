import { describe, expect, it, vi } from 'vitest';
import { ParameterManager, resolveFlowParameterValues } from './parameter-manager';
import type { TestFlowData } from '$lib/components/test-flows/types';

describe('resolveFlowParameterValues', () => {
  it('uses mapped environment values before parameter defaults', () => {
    const flowData: Pick<TestFlowData, 'parameters' | 'settings'> = {
      parameters: [
        {
          name: 'token',
          type: 'string',
          required: true,
          defaultValue: 'default-token'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          defaultValue: 10
        }
      ],
      settings: {
        environment: {
          environmentId: 7,
          subEnvironment: 'dev'
        },
        linkedEnvironment: {
          environmentId: 7,
          environmentName: 'Local',
          parameterMappings: {
            token: 'api_token'
          }
        }
      }
    };

    const resolved = resolveFlowParameterValues(flowData, {
      api_token: 'env-token'
    });

    expect(resolved).toEqual([
      {
        name: 'token',
        value: 'env-token',
        source: 'environment',
        sourceName: 'api_token'
      },
      {
        name: 'limit',
        value: 10,
        source: 'default'
      }
    ]);
  });

  it('falls back to defaults when no selected environment mapping is available', () => {
    const flowData: Pick<TestFlowData, 'parameters' | 'settings'> = {
      parameters: [
        {
          name: 'token',
          type: 'string',
          required: true,
          defaultValue: 'default-token'
        }
      ],
      settings: {
        environment: {
          environmentId: null,
          subEnvironment: null
        },
        linkedEnvironment: {
          environmentId: 7,
          environmentName: 'Local',
          parameterMappings: {
            token: 'api_token'
          }
        }
      }
    };

    const resolved = resolveFlowParameterValues(flowData, {
      api_token: 'env-token'
    });

    expect(resolved).toEqual([
      {
        name: 'token',
        value: 'default-token',
        source: 'default'
      }
    ]);
  });

  it('falls back to defaults when linked environment has no parameter mappings', () => {
    const flowData: Pick<TestFlowData, 'parameters' | 'settings'> = {
      parameters: [
        {
          name: 'username',
          type: 'string',
          required: true,
          defaultValue: 'admin'
        }
      ],
      settings: {
        environment: {
          environmentId: 9,
          subEnvironment: 'sit'
        },
        linkedEnvironment: {
          environmentId: 9,
          environmentName: 'Swim'
        } as TestFlowData['settings']['linkedEnvironment']
      }
    };

    const resolved = resolveFlowParameterValues(flowData, {
      username: 'env-admin'
    });

    expect(resolved).toEqual([
      {
        name: 'username',
        value: 'admin',
        source: 'default'
      }
    ]);
  });
});

describe('ParameterManager logging', () => {
  it('redacts sensitive parameter values in logs while preserving execution values', () => {
    const addLog = vi.fn();
    const flowData: TestFlowData = {
      parameters: [
        {
          name: 'username',
          type: 'string',
          required: true,
          defaultValue: 'admin'
        },
        {
          name: 'password',
          type: 'string',
          required: true,
          defaultValue: 'super-secret'
        },
        {
          name: 'api_key',
          type: 'string',
          required: true,
          defaultValue: 'key-secret'
        }
      ],
      settings: {
        environment: {
          environmentId: null,
          subEnvironment: null
        }
      },
      steps: []
    };

    const manager = new ParameterManager({
      flowData,
      environmentVariables: {},
      selectedEnvironment: null,
      addLog
    });

    const values = manager.prepareParameters();

    expect(values).toEqual({
      username: 'admin',
      password: 'super-secret',
      api_key: 'key-secret'
    });
    expect(JSON.stringify(addLog.mock.calls)).toContain('[REDACTED]');
    expect(JSON.stringify(addLog.mock.calls)).not.toContain('super-secret');
    expect(JSON.stringify(addLog.mock.calls)).not.toContain('key-secret');
  });
});
