import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SequenceParameterResolver } from './parameter-resolver';
import type { FlowSequenceStep } from '$lib/types/flow_sequence';
import type { TestFlow } from '$lib/types/test-flow';

describe('SequenceParameterResolver', () => {
  let mockOnLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnLog = vi.fn();
  });

  describe('flow parameter resolution', () => {
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
            defaultValue: 30000
          },
          {
            name: 'debug_mode',
            type: 'boolean',
            required: false,
            value: null,
            description: 'Enable debug logging',
            defaultValue: false
          }
        ],
        outputs: [
          {
            name: 'access_token',
            value: '{{response.token}}',
            description: 'Auth token',
            isTemplate: true,
            type: 'string'
          }
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
          {
            name: 'user_id',
            value: '{{response.user.id}}',
            description: 'Created user ID',
            isTemplate: true,
            type: 'number'
          }
        ],
        steps: []
      }
    };

    it('resolves static, environment, default, and previous output parameters', () => {
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
            source_type: 'environment_variable',
            source_value: 'API_BASE_URL'
          },
          {
            flow_parameter_name: 'debug_mode',
            source_type: 'environment_variable',
            source_value: 'DEBUG_ENABLED'
          }
        ]
      };
      const environmentVariables = {
        API_BASE_URL: 'https://api.dev.ecommerce.com',
        DEBUG_ENABLED: true
      };

      const loginResult = SequenceParameterResolver.resolveFlowParameters(
        loginFlow,
        loginStep,
        {},
        environmentVariables,
        { '1': 'https://api.dev.ecommerce.com' },
        mockOnLog
      );

      expect(loginResult.resolvedParameters).toEqual({
        api_key: 'dev-api-key-12345',
        base_url: 'https://api.dev.ecommerce.com',
        api_timeout: 30000,
        debug_mode: true
      });
      expect(loginResult.flowData.settings.api_hosts).toEqual({
        '1': { url: 'https://api.dev.ecommerce.com' }
      });

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
          }
        ]
      };
      const previousOutputs = {
        flow_1: {
          access_token: 'bearer-token-xyz789',
          user_id: '12345'
        }
      };

      const createUserResult = SequenceParameterResolver.resolveFlowParameters(
        createUserFlow,
        createUserStep,
        previousOutputs,
        environmentVariables,
        { '1': 'https://api.dev.ecommerce.com' },
        mockOnLog
      );

      expect(createUserResult.resolvedParameters).toEqual({
        auth_token: 'bearer-token-xyz789',
        user_email: 'testuser@example.com',
        retry_count: 3
      });
    });

    it('uses flow defaults when no parameter mapping is provided', () => {
      const loginStep: FlowSequenceStep = {
        id: 'login-step-defaults',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'api_key',
            source_type: 'static_value',
            source_value: 'prod-api-key-67890'
          }
        ]
      };

      const result = SequenceParameterResolver.resolveFlowParameters(
        loginFlow,
        loginStep,
        {},
        {},
        {},
        mockOnLog
      );

      expect(result.resolvedParameters).toEqual({
        api_key: 'prod-api-key-67890',
        base_url: null,
        api_timeout: 30000,
        debug_mode: false
      });
    });

    it('converts typed static values', () => {
      const step: FlowSequenceStep = {
        id: 'typed-static-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [
          {
            flow_parameter_name: 'api_timeout',
            source_type: 'static_value',
            source_value: '15000',
            data_type: 'number'
          },
          {
            flow_parameter_name: 'debug_mode',
            source_type: 'static_value',
            source_value: 'true',
            data_type: 'boolean'
          }
        ]
      };

      const result = SequenceParameterResolver.resolveFlowParameters(
        loginFlow,
        step,
        {},
        {},
        {},
        mockOnLog
      );

      expect(result.resolvedParameters).toMatchObject({
        api_timeout: 15000,
        debug_mode: true
      });
    });
  });

  describe('error response utils', () => {
    it('detects errors correctly', () => {
      expect(SequenceParameterResolver.hasErrorInResponse({ __error: 'failed' })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ error: 'failed' })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ success: false })).toBe(true);
      expect(SequenceParameterResolver.hasErrorInResponse({ success: true })).toBe(false);
      expect(SequenceParameterResolver.hasErrorInResponse({})).toBe(false);
    });

    it('extracts error messages correctly', () => {
      expect(SequenceParameterResolver.getErrorFromResponse({ __error: 'priority error' })).toBe(
        'priority error'
      );
      expect(SequenceParameterResolver.getErrorFromResponse({ error: 'error msg' })).toBe(
        'error msg'
      );
      expect(SequenceParameterResolver.getErrorFromResponse({ message: 'general msg' })).toBe(
        'general msg'
      );
      expect(SequenceParameterResolver.getErrorFromResponse({})).toBe(
        'Unknown error from API response'
      );
    });
  });
});
