import { describe, expect, it } from 'vitest';
import { resolveApiHostCoverage, resolveEndpointApiHost } from './api-hosts';
import type { TestFlowData } from '$lib/components/test-flows/types';
import type { Environment } from '$lib/types/environment';

const environment: Environment = {
  id: 9,
  name: 'Swim',
  userId: 1,
  config: {
    type: 'environment_set',
    variable_definitions: {},
    environments: {
      sit: {
        name: 'SIT',
        variables: {},
        api_hosts: {
          '1': 'https://sit-api.example.com'
        }
      },
      local: {
        name: 'Local',
        variables: {},
        api_hosts: {}
      }
    }
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function createFlowData(): Pick<TestFlowData, 'settings' | 'steps'> {
  return {
    settings: {
      api_hosts: {
        1: { url: 'https://flow-api-1.example.com' },
        2: { url: 'https://flow-api-2.example.com' }
      },
      environment: {
        environmentId: 9,
        subEnvironment: 'sit'
      }
    },
    steps: [
      {
        step_id: 'step-1',
        label: 'Step 1',
        endpoints: [
          {
            endpoint_id: 101,
            api_id: 1
          },
          {
            endpoint_id: 102,
            api_id: 2
          }
        ]
      }
    ]
  };
}

describe('resolveEndpointApiHost', () => {
  it('uses the selected sub-environment API host before the flow fallback', () => {
    const resolved = resolveEndpointApiHost({
      endpoint: { api_id: 1 },
      flowData: createFlowData(),
      environment,
      selectedSubEnvironment: 'sit'
    });

    expect(resolved).toEqual({
      apiId: '1',
      url: 'https://sit-api.example.com',
      source: 'environment',
      environmentName: 'Swim',
      subEnvironment: 'sit'
    });
  });

  it('falls back to flow API hosts when the environment does not provide that API ID', () => {
    const resolved = resolveEndpointApiHost({
      endpoint: { api_id: 2 },
      flowData: createFlowData(),
      environment,
      selectedSubEnvironment: 'sit'
    });

    expect(resolved).toEqual({
      apiId: '2',
      url: 'https://flow-api-2.example.com',
      source: 'flow'
    });
  });
});

describe('resolveApiHostCoverage', () => {
  it('marks the flow runnable when every used API ID resolves from environment or fallback', () => {
    const coverage = resolveApiHostCoverage({
      flowData: createFlowData(),
      environment,
      selectedSubEnvironment: 'sit'
    });

    expect(coverage.hasRequiredHosts).toBe(true);
    expect(coverage.requiredApiIds).toEqual(['1', '2']);
    expect(coverage.missingApiIds).toEqual([]);
    expect(coverage.resolvedHosts['1']?.source).toBe('environment');
    expect(coverage.resolvedHosts['2']?.source).toBe('flow');
  });

  it('reports API IDs that cannot be resolved from environment or flow fallback', () => {
    const flowData = createFlowData();
    flowData.settings.api_hosts = {
      1: { url: '' }
    };

    const coverage = resolveApiHostCoverage({
      flowData,
      environment,
      selectedSubEnvironment: 'local'
    });

    expect(coverage.hasRequiredHosts).toBe(false);
    expect(coverage.missingApiIds).toEqual(['1', '2']);
  });
});
