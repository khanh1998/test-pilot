import { describe, expect, it } from 'vitest';
import { resolveFlowParameterValues } from './parameter-manager';
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
});
