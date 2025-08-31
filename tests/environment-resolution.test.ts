import { describe, it, expect } from 'vitest';
import { validateSubEnvironmentExists, getAvailableSubEnvironments } from '$lib/server/service/environments/resolve_environment_variables';
import type { EnvironmentConfig } from '$lib/types/environment';

describe('Environment Variables Resolution', () => {
  const sampleConfig: EnvironmentConfig = {
    type: 'environment_set',
    environments: {
      dev: {
        name: 'Development',
        variables: { username: 'dev_user', password: 'dev123' },
        api_hosts: { '1': 'https://dev.api.com' }
      },
      prod: {
        name: 'Production',
        variables: { username: 'prod_user' },
        api_hosts: { '1': 'https://api.com' }
      }
    },
    variable_definitions: {
      username: {
        type: 'string',
        required: true,
        default_value: 'default_user'
      },
      password: {
        type: 'string',
        required: false,
        default_value: 'default_pass'
      }
    }
  };

  it('should get available sub-environments', () => {
    const subEnvs = getAvailableSubEnvironments(sampleConfig);
    expect(subEnvs).toEqual(['dev', 'prod']);
  });

  it('should validate sub-environment exists', () => {
    expect(validateSubEnvironmentExists(sampleConfig, 'dev')).toBe(true);
    expect(validateSubEnvironmentExists(sampleConfig, 'prod')).toBe(true);
    expect(validateSubEnvironmentExists(sampleConfig, 'test')).toBe(false);
  });
});
