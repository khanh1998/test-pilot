import { describe, expect, it } from 'vitest';
import { SequenceParameterResolver } from './parameter-resolver';
import type { Environment } from '$lib/types/environment';

describe('SequenceParameterResolver.getEnvironmentVariables', () => {
  it('uses variable definition defaults when sub-environment values are empty', () => {
    const environment: Environment = {
      id: 9,
      name: 'local',
      userId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      config: {
        type: 'environment_set',
        variable_definitions: {
          username_a: {
            type: 'string',
            required: false,
            description: '',
            default_value: 'user_a'
          },
          password_a: {
            type: 'string',
            required: false,
            description: '',
            default_value: 'Pass@UserA1'
          }
        },
        environments: {
          dev: {
            name: 'Development',
            variables: {},
            api_hosts: {}
          }
        }
      }
    };

    expect(SequenceParameterResolver.getEnvironmentVariables(environment, 'dev')).toEqual({
      username_a: 'user_a',
      password_a: 'Pass@UserA1'
    });
  });

  it('lets sub-environment values override variable definition defaults', () => {
    const environment: Environment = {
      id: 9,
      name: 'local',
      userId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      config: {
        type: 'environment_set',
        variable_definitions: {
          username_a: {
            type: 'string',
            required: false,
            description: '',
            default_value: 'user_a'
          }
        },
        environments: {
          dev: {
            name: 'Development',
            variables: {
              username_a: 'dev_user_a'
            },
            api_hosts: {}
          }
        }
      }
    };

    expect(SequenceParameterResolver.getEnvironmentVariables(environment, 'dev')).toEqual({
      username_a: 'dev_user_a'
    });
  });

  it('resolves sequence parameter mappings from default environment values', () => {
    const environment: Environment = {
      id: 9,
      name: 'local',
      userId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      config: {
        type: 'environment_set',
        variable_definitions: {
          username_a: {
            type: 'string',
            required: false,
            description: '',
            default_value: 'user_a'
          }
        },
        environments: {
          dev: {
            name: 'Development',
            variables: {},
            api_hosts: {}
          }
        }
      }
    };

    const environmentVariables = SequenceParameterResolver.getEnvironmentVariables(
      environment,
      'dev'
    );
    const resolved = SequenceParameterResolver.resolveFlowParameters(
      {
        id: '200',
        name: 'sent private message',
        apiId: 28,
        steps: [],
        flowJson: {
          parameters: [
            {
              name: 'user_a',
              type: 'string',
              required: true,
              value: null,
              description: '',
              defaultValue: null
            }
          ],
          outputs: [],
          steps: []
        }
      },
      {
        id: 'step-1',
        test_flow_id: 200,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'user_a',
            source_type: 'environment_variable',
            source_value: 'username_a'
          }
        ]
      },
      {},
      environmentVariables,
      {},
      () => {}
    );

    expect(resolved.resolvedParameters).toEqual({
      user_a: 'user_a'
    });
  });
});
