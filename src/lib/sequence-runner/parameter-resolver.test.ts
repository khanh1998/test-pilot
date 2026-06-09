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

    it('resolves current loop value parameters', () => {
      const step: FlowSequenceStep = {
        id: 'loop-step',
        test_flow_id: 2,
        step_order: 2,
        parameter_mappings: [
          {
            flow_parameter_name: 'user_email',
            source_type: 'loop_value',
            source_value: 'email',
            loop_id: 'loop_user',
            loop_source_id: 'source_email'
          }
        ],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_user',
            name: 'user',
            sources: [
              {
                id: 'source_email',
                alias: 'email',
                source_type: 'environment_variable_array',
                source_value: 'emails'
              }
            ]
          }
        }
      };

      const result = SequenceParameterResolver.resolveFlowParameters(
        createUserFlow,
        step,
        {},
        {},
        {},
        mockOnLog,
        {
          path: [
            {
              loopId: 'loop_user',
              loopName: 'user',
              index: 0,
              valuesBySourceId: { source_email: 'testuser@example.com' },
              sourceAliases: { source_email: 'email' }
            }
          ],
          valuesByLoopId: {
            loop_user: {
              loopName: 'user',
              index: 0,
              valuesBySourceId: { source_email: 'testuser@example.com' },
              sourceAliases: { source_email: 'email' }
            }
          }
        }
      );

      expect(result.resolvedParameters).toMatchObject({
        user_email: 'testuser@example.com'
      });
    });

    it('resolves legacy current loop value mappings without loop IDs', () => {
      const step = {
        id: 'legacy-loop-step',
        test_flow_id: 2,
        step_order: 2,
        parameter_mappings: [
          {
            flow_parameter_name: 'user_email',
            source_type: 'loop_value',
            source_value: 'value'
          }
        ],
        loop_config: {
          enabled: true,
          source_type: 'environment_variable_array',
          source_value: 'emails'
        }
      } as unknown as FlowSequenceStep;

      const loopPlan = SequenceParameterResolver.resolveLoopPlan(
        step,
        {},
        { emails: ['legacy@example.com'] },
        mockOnLog
      );
      const row = loopPlan?.rows[0];
      const result = SequenceParameterResolver.resolveFlowParameters(
        createUserFlow,
        step,
        {},
        {},
        {},
        mockOnLog,
        row
          ? {
              path: [row],
              valuesByLoopId: {
                [row.loopId]: {
                  loopName: row.loopName,
                  index: row.index,
                  valuesBySourceId: row.valuesBySourceId,
                  sourceAliases: row.sourceAliases
                }
              }
            }
          : undefined
      );

      expect(result.resolvedParameters).toMatchObject({
        user_email: 'legacy@example.com'
      });
    });

    it('resolves fixed count loop values as numeric indexes', () => {
      const step: FlowSequenceStep = {
        id: 'fixed-loop-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_user',
            name: 'user',
            sources: [{ id: 'source_index', alias: 'index', source_type: 'fixed_count', count: 3 }]
          }
        }
      };

      const plan = SequenceParameterResolver.resolveLoopPlan(step, {}, {}, mockOnLog);
      expect(plan?.rows.map((row) => row.valuesBySourceId.source_index)).toEqual([0, 1, 2]);
    });

    it('resolves zipped environment primitive array loop rows', () => {
      const step: FlowSequenceStep = {
        id: 'env-loop-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_order',
            name: 'order',
            sources: [
              {
                id: 'source_order_id',
                alias: 'id',
                source_type: 'environment_variable_array',
                source_value: 'order_ids'
              },
              {
                id: 'source_priority',
                alias: 'priority',
                source_type: 'environment_variable_array',
                source_value: 'priorities'
              }
            ]
          }
        }
      };

      const plan = SequenceParameterResolver.resolveLoopPlan(
        step,
        {},
        { order_ids: ['ord_1', 'ord_2'], priorities: [1, 2] },
        mockOnLog
      );

      expect(plan?.rows).toMatchObject([
        { valuesBySourceId: { source_order_id: 'ord_1', source_priority: 1 } },
        { valuesBySourceId: { source_order_id: 'ord_2', source_priority: 2 } }
      ]);
    });

    it('resolves previous output primitive array loop values', () => {
      const step: FlowSequenceStep = {
        id: 'previous-loop-step',
        test_flow_id: 2,
        step_order: 2,
        parameter_mappings: [],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_order',
            name: 'order',
            sources: [
              {
                id: 'source_order_id',
                alias: 'id',
                source_type: 'previous_output_array',
                source_flow_step: 1,
                source_output_field: 'order_id'
              }
            ]
          }
        }
      };

      const plan = SequenceParameterResolver.resolveLoopPlan(
        step,
        { flow_1: { order_id: [101, 102] } },
        {},
        mockOnLog
      );
      expect(plan?.rows.map((row) => row.valuesBySourceId.source_order_id)).toEqual([101, 102]);
    });

    it('rejects object and null loop array values', () => {
      const step: FlowSequenceStep = {
        id: 'invalid-loop-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_item',
            name: 'item',
            sources: [
              {
                id: 'source_item',
                alias: 'value',
                source_type: 'environment_variable_array',
                source_value: 'items'
              }
            ]
          }
        }
      };

      expect(() =>
        SequenceParameterResolver.resolveLoopPlan(step, {}, { items: [{ id: 1 }] }, mockOnLog)
      ).toThrow(/string, number, or boolean/);

      expect(() =>
        SequenceParameterResolver.resolveLoopPlan(step, {}, { items: [null] }, mockOnLog)
      ).toThrow(/string, number, or boolean/);
    });

    it('rejects mismatched zip source lengths', () => {
      const step: FlowSequenceStep = {
        id: 'zip-loop-step',
        test_flow_id: 1,
        step_order: 1,
        parameter_mappings: [],
        loop_config: {
          enabled: true,
          root: {
            id: 'loop_user',
            name: 'user',
            sources: [
              {
                id: 'source_email',
                alias: 'email',
                source_type: 'environment_variable_array',
                source_value: 'emails'
              },
              {
                id: 'source_role',
                alias: 'role',
                source_type: 'environment_variable_array',
                source_value: 'roles'
              }
            ]
          }
        }
      };

      expect(() =>
        SequenceParameterResolver.resolveLoopPlan(
          step,
          {},
          { emails: ['a@example.com', 'b@example.com'], roles: ['admin'] },
          mockOnLog
        )
      ).toThrow(/expected 2/);
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
