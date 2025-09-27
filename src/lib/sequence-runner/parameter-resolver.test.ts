import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SequenceParameterResolver } from './parameter-resolver';
import type { TestFlow } from '$lib/types/test-flow';
import type { FlowSequenceStep, FlowParameterMapping } from '$lib/types/flow_sequence';
import type { Environment } from '$lib/types/environment';
import type { Project } from '$lib/types/project';

describe('SequenceParameterResolver', () => {
  let mockOnLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnLog = vi.fn();
  });

  describe('Realistic API Test Flow Scenario', () => {
    // Setup: Login Flow -> Create User Flow -> Get User Flow
    const loginFlow: TestFlow = {
      id: '1',
      name: 'Login Flow',
      apiId: 1,
      steps: [],
      flowJson: {
        parameters: [
          {
            name: 'api_key',
            type: 'string',
            required: true,
            value: null,
            description: 'API Key for auth',
            defaultValue: null
          },
          {
            name: 'base_url',
            type: 'string',
            required: true,
            value: null,
            description: 'Base API URL',
            defaultValue: null
          },
          {
            name: 'api_timeout',
            type: 'number',
            required: false,
            value: null,
            description: 'Request timeout in ms',
            defaultValue: null
          },
          {
            name: 'debug_mode',
            type: 'boolean',
            required: false,
            value: null,
            description: 'Enable debug logging',
            defaultValue: null
          }
        ],
        outputs: [
          { name: 'access_token', value: '{{response.token}}', description: 'Auth token', isTemplate: true, type: 'string' }
        ],
        steps: []
      }
    };

    const createUserFlow: TestFlow = {
      id: '2',
      name: 'Create User Flow',
      apiId: 1,
      steps: [],
      flowJson: {
        parameters: [
          {
            name: 'auth_token',
            type: 'string',
            required: true,
            value: null,
            description: 'Auth token from login',
            defaultValue: null
          },
          {
            name: 'user_email',
            type: 'string',
            required: true,
            value: null,
            description: 'Email for new user',
            defaultValue: null
          },
          {
            name: 'retry_count',
            type: 'number',
            required: false,
            value: null,
            description: 'Number of retries',
            defaultValue: 3
          }
        ],
        outputs: [
          { name: 'user_id', value: '{{response.user.id}}', description: 'Created user ID', isTemplate: true, type: 'number' }
        ],
        steps: []
      }
    };

    const getUserFlow: TestFlow = {
      id: '3',
      name: 'Get User Flow',
      apiId: 1,
      steps: [],
      flowJson: {
        parameters: [
          {
            name: 'auth_token',
            type: 'string',
            required: true,
            value: null,
            description: 'Auth token',
            defaultValue: null
          },
          {
            name: 'user_id',
            type: 'string',
            required: true,
            value: null,
            description: 'User ID to fetch',
            defaultValue: null
          },
          {
            name: 'base_url',
            type: 'string',
            required: true,
            value: null,
            description: 'Base API URL',
            defaultValue: null
          }
        ],
        outputs: [],
        steps: []
      }
    };

    const project: Project = {
      id: 1,
      name: 'E-commerce API Project',
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectJson: {
        variables: [
          {
            name: 'base_url',
            type: 'string',
            default_value: 'https://api.prod.ecommerce.com'
          },
          {
            name: 'api_timeout',
            type: 'number',
            default_value: 30000
          },
          {
            name: 'retry_count',
            type: 'number',
            default_value: 3
          },
          {
            name: 'debug_mode',
            type: 'boolean',
            default_value: false
          }
        ],
        api_hosts: {
          'main': {
            api_id: 1,
            name: 'Main API',
            default_host: 'https://api.prod.ecommerce.com'
          }
        },
        environment_mappings: [
          {
            environment_id: 1,
            variable_mappings: {
              'base_url': 'API_BASE_URL',
              'debug_mode': 'DEBUG_ENABLED'
              // api_timeout and retry_count NOT mapped - will use defaults
            }
          }
        ]
      }
    };

    const environment: Environment = {
      id: 1,
      name: 'Testing Environment',
      userId: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      config: {
        type: 'environment_set',
        variable_definitions: {
          'API_BASE_URL': {
            type: 'string',
            description: 'Base URL for the API',
            required: false,
            default_value: 'https://api.example.com'
          },
          'DEBUG_ENABLED': {
            type: 'boolean',
            description: 'Enable debug mode',
            required: false,
            default_value: false
          }
        },
        environments: {
          dev: {
            name: 'Development',
            variables: {
              'API_BASE_URL': 'https://api.dev.ecommerce.com',
              'DEBUG_ENABLED': true
            },
            api_hosts: {
              '1': 'https://api.dev.ecommerce.com'
            }
          },
          staging: {
            name: 'Staging',
            variables: {
              'API_BASE_URL': 'https://api.staging.ecommerce.com',
              'DEBUG_ENABLED': false
            },
            api_hosts: {
              '1': 'https://api.staging.ecommerce.com'
            }
          }
        }
      }
    };

    it('should resolve all 3 parameter sources in sequence - with sub-environment', () => {
      // Step 1: Login flow parameters
      const loginStep: FlowSequenceStep = {
        id: 'login-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'api_key',
            source_type: 'static_value',
            source_value: 'dev-api-key-12345'
          },
          {
            flow_parameter_name: 'base_url',
            source_type: 'project_variable',
            source_value: 'base_url'
          },
          {
            flow_parameter_name: 'api_timeout',
            source_type: 'project_variable',
            source_value: 'api_timeout'
          },
          {
            flow_parameter_name: 'debug_mode',
            source_type: 'project_variable',
            source_value: 'debug_mode'
          }
        ]
      };

      // Environment variables with dev sub-env selected
      const envVars = {
        'API_BASE_URL': 'https://api.dev.ecommerce.com',
        'DEBUG_ENABLED': true
        // Note: api_timeout not in env vars, should use project default
      };

      const loginResult = SequenceParameterResolver.resolveFlowParameters(
        loginFlow, loginStep, {}, envVars, environment, 'dev', project, mockOnLog
      );

      expect(loginResult.resolvedParameters).toEqual({
        api_key: 'dev-api-key-12345',
        base_url: 'https://api.dev.ecommerce.com', // from env var (mapped)
        api_timeout: 30000, // from project default (not mapped)
        debug_mode: true // from env var (mapped, converted to boolean)
      });

      // Step 2: Create user flow - uses previous output + static + project var
      const createUserStep: FlowSequenceStep = {
        id: 'create-user-step',
        test_flow_id: 2,
        step_order: 2,
        parameter_mappings: [
          {
            flow_parameter_name: 'auth_token',
            source_type: 'previous_output',
            source_value: 'access_token',
            source_flow_step: 1,
            source_output_field: 'access_token'
          },
          {
            flow_parameter_name: 'user_email',
            source_type: 'static_value',
            source_value: 'testuser@example.com'
          },
          {
            flow_parameter_name: 'retry_count',
            source_type: 'project_variable',
            source_value: 'retry_count'
          }
        ]
      };

      // Previous outputs from login step - structured as expected by the resolver
      const previousOutputs = {
        'flow_1': {
          'access_token': 'bearer-token-xyz789',
          'user_id': '12345'
        }
      };

      const createUserResult = SequenceParameterResolver.resolveFlowParameters(
        createUserFlow, createUserStep, previousOutputs, envVars, environment, 'dev', project, mockOnLog
      );

      expect(createUserResult.resolvedParameters).toEqual({
        auth_token: 'bearer-token-xyz789', // from previous output
        user_email: 'testuser@example.com', // static value
        retry_count: 3 // from project default (not mapped to env)
      });
    });

    it('should resolve project variables without sub-environment (use defaults)', () => {
      // Test when no sub-environment is selected - should use project defaults
      const loginStep: FlowSequenceStep = {
        id: 'login-step-no-env',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'base_url',
            source_type: 'project_variable',
            source_value: 'base_url'
          },
          {
            flow_parameter_name: 'debug_mode',
            source_type: 'project_variable',
            source_value: 'debug_mode'
          }
        ]
      };

      // No environment variables provided
      const noEnvVars = {};

      const result = SequenceParameterResolver.resolveFlowParameters(
        loginFlow, loginStep, {}, noEnvVars, environment, null, project, mockOnLog
      );

      expect(result.resolvedParameters).toEqual({
        base_url: 'https://api.prod.ecommerce.com', // from project default (no env mapping)
        debug_mode: false, // from project default (no env mapping)
        api_key: null,
        api_timeout: 30000,
      });
    });

    it('should resolve API hosts for different environments', () => {
      const devHosts = SequenceParameterResolver.resolveApiHosts(environment, 'dev', project, mockOnLog);
      expect(devHosts).toEqual({
        '1': {
        "description": "Environment Testing Environment (dev) host",
        "name": "Main API",
        "url": "https://api.dev.ecommerce.com",
   },
      });

      const stagingHosts = SequenceParameterResolver.resolveApiHosts(environment, 'staging', project, mockOnLog);
      expect(stagingHosts).toEqual({
         "1": {
            "description": "Environment Testing Environment (staging) host",
            "name": "Main API",
            "url": "https://api.staging.ecommerce.com"
        }
      });

      // Test with no sub-environment - should use project defaults
      const noEnvHosts = SequenceParameterResolver.resolveApiHosts(environment, null, project, mockOnLog);
      expect(noEnvHosts).toEqual({
        "1": {
            "description": "Project default host",
            "name": "Main API",
            "url": "https://api.prod.ecommerce.com",
        },
      });
    });


    it('should fallback to project variable default when no sub-environment selected', () => {
      const loginStep: FlowSequenceStep = {
        id: 'login-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'api_key',
            source_type: 'static_value',
            source_value: 'prod-api-key-67890'
          },
          {
            flow_parameter_name: 'base_url',
            source_type: 'project_variable',
            source_value: 'base_url'
          }
        ]
      };

      // No sub-environment selected, should use project variable default
      const loginResult = SequenceParameterResolver.resolveFlowParameters(
        loginFlow, loginStep, {}, {}, environment, null, project, mockOnLog
      );

      expect(loginResult.resolvedParameters).toEqual({
        api_key: 'prod-api-key-67890',
        base_url: 'https://api.prod.ecommerce.com', // project variable default
        api_timeout: 30000,
        debug_mode: false,
      });
    });

    it('should resolve API hosts with environment override', () => {
      // With dev environment
      const devHosts = SequenceParameterResolver.resolveApiHosts(environment, 'dev', project, mockOnLog);
      expect(devHosts).toEqual({
        '1': {
          url: 'https://api.dev.ecommerce.com',
          name: 'Main API',
          description: 'Environment Testing Environment (dev) host'
        }
      });

      // With staging environment
      const stagingHosts = SequenceParameterResolver.resolveApiHosts(environment, 'staging', project, mockOnLog);
      expect(stagingHosts).toEqual({
        '1': {
          url: 'https://api.staging.ecommerce.com',
          name: 'Main API',
          description: 'Environment Testing Environment (staging) host'
        }
      });

      // No environment - fallback to project default
      const prodHosts = SequenceParameterResolver.resolveApiHosts(null, null, project, mockOnLog);
      expect(prodHosts).toEqual({
        '1': {
          url: 'https://api.prod.ecommerce.com',
          name: 'Main API',
          description: 'Project default host'
        }
      });
    });
  });

  describe('Error Response Utils', () => {
    it('should detect errors correctly', () => {
      expect(SequenceParameterResolver.hasErrorInResponse({ __error: 'failed' })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ error: 'failed' })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ success: false })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ success: true })).toBe(false);
      expect(SequenceParameterResolver.hasErrorInResponse({})).toBe(false);
    });

    it('should extract error messages correctly', () => {
      expect(SequenceParameterResolver.getErrorFromResponse({ __error: 'priority error' })).toBe('priority error');
      expect(SequenceParameterResolver.getErrorFromResponse({ error: 'error msg' })).toBe('error msg');
      expect(SequenceParameterResolver.getErrorFromResponse({ message: 'general msg' })).toBe('general msg');
      expect(SequenceParameterResolver.getErrorFromResponse({})).toBe('Unknown error from API response');
    });
  });
});
