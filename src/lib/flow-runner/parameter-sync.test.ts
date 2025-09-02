/**
 * Integration test to verify that ephemeral parameter values are properly
 * synchronized with the execution context for template resolution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowRunner } from './flow-runner';
import type { FlowRunnerOptions } from './flow-runner';
import type { TestFlowData } from '$lib/components/test-flows/types';

// Mock the HTTP client
vi.mock('$lib/http_client', () => ({
  performRequest: vi.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    body: { success: true }
  })
}));

describe('Parameter Synchronization Bug Fix', () => {
  let mockOptions: FlowRunnerOptions;
  let mockFlowData: TestFlowData;

  beforeEach(() => {
    mockFlowData = {
      parameters: [
        {
          name: 'username',
          type: 'string',
          required: true,
          value: 'jane.smith'
        },
        {
          name: 'password',
          type: 'string',
          required: true,
          value: 'm@_stEr@1_$2'
        }
      ],
      outputs: [],
      settings: {
        api_hosts: {},
        environment: {
          environmentId: null,
          subEnvironment: null
        }
      },
      steps: [
        {
          step_id: 'login-step',
          label: 'Login Step',
          endpoints: [
            {
              endpoint_id: 1,
              api_id: 1,
              body: {
                password: '{{param:password}}',
                username: '{{param:username}}',
                user_type: 'employee'
              }
            }
          ]
        }
      ],
      endpoints: [
        {
          id: 1,
          apiId: 1,
          path: '/api/login',
          method: 'POST',
          parameters: []
        }
      ]
    };

    mockOptions = {
      flowData: mockFlowData,
      preferences: {
        parallelExecution: false,
        stopOnError: true,
        serverCookieHandling: false,
        retryCount: 0,
        timeout: 30000
      },
      environments: [],
      selectedEnvironment: null,
      environmentVariables: {},
      onLog: vi.fn(),
      onExecutionStateUpdate: vi.fn(),
      onEndpointStateUpdate: vi.fn(),
      onStepExecutionComplete: vi.fn(),
      onExecutionStart: vi.fn(),
      onExecutionComplete: vi.fn()
    };
  });

  it('should synchronize ephemeral parameter values with execution context for template resolution', () => {
    const flowRunner = new FlowRunner(mockOptions);

    // Initially, execution context should have empty parameters
    expect(flowRunner['executionEngine']['context'].parameterValues).toEqual({});

    // Prepare parameters (this simulates the first part of runFlow)
    const preparedParams = flowRunner['parameterManager'].prepareParameters();
    flowRunner['state'].parameterValues = preparedParams;
    
    // Before fix: execution context would still have empty parameters
    // After fix: updateParameterValues should sync the context
    flowRunner['executionEngine'].updateParameterValues(flowRunner['state'].parameterValues);

    // Verify that the execution context now has the same values as the prepared parameters
    expect(flowRunner['executionEngine']['context'].parameterValues).toEqual(preparedParams);

    // Also verify that the state has the expected values
    expect(flowRunner['state'].parameterValues).toEqual(preparedParams);
  });

  it('should update execution context when parameters are provided through modal', () => {
    // Start with parameters that have no values (simulating missing required parameters)
    mockFlowData.parameters = [
      {
        name: 'username',
        type: 'string',
        required: true,
        value: undefined
      },
      {
        name: 'password',
        type: 'string',
        required: true,
        value: undefined
      }
    ];

    const flowRunner = new FlowRunner(mockOptions);

    // Prepare initial parameters (should be empty since no values are set)
    const initialParams = flowRunner['parameterManager'].prepareParameters();
    expect(initialParams).toEqual({});

    // Simulate user providing values through the modal
    const parametersWithValues = [
      {
        name: 'username',
        type: 'string' as const,
        required: true,
        value: 'user_from_modal'
      },
      {
        name: 'password',
        type: 'string' as const,
        required: true,
        value: 'pass_from_modal'
      }
    ];
    
    // Update parameter values (this is what happens when modal is submitted)
    flowRunner.updateParameterValues(parametersWithValues);

    // Verify the execution context has the updated parameter values
    expect(flowRunner['executionEngine']['context'].parameterValues).toEqual({
      username: 'user_from_modal',
      password: 'pass_from_modal'
    });
  });
});
