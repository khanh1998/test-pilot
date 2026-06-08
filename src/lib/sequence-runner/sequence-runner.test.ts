import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SequenceRunner } from './sequence-runner';
import type { Environment } from '$lib/types/environment';
import type { FlowSequence } from '$lib/types/flow_sequence';
import type { TestFlow } from '$lib/types/test-flow';
import type { ExecutionPreferences } from '$lib/flow-runner/execution-engine';

const flowRunnerMock = vi.hoisted(() => {
  const queuedResults: Array<{
    success: boolean;
    error?: unknown;
    outputs: Record<string, unknown>;
    responses?: Record<string, unknown>;
  }> = [];
  const parameterValues: Array<Record<string, unknown>> = [];

  class MockFlowRunner {
    private options: any;
    private parameters: Record<string, unknown> = {};

    constructor(options: any) {
      this.options = options;
    }

    setParameterValues(parameters: Record<string, unknown>) {
      this.parameters = parameters;
      parameterValues.push(parameters);
    }

    async executeFlowAfterParameterCheck() {
      const result = queuedResults.shift();
      if (!result) {
        throw new Error('No mocked flow result queued');
      }

      this.options.onExecutionComplete?.({
        success: result.success,
        error: result.error,
        storedResponses: result.responses || {},
        storedTransformations: {},
        executionState: {},
        parameterValues: this.parameters,
        flowOutputs: result.outputs
      });

      return { success: result.success, error: result.error };
    }
  }

  return { queuedResults, parameterValues, MockFlowRunner };
});

vi.mock('$lib/flow-runner', () => ({
  FlowRunner: flowRunnerMock.MockFlowRunner
}));

describe('SequenceRunner loop mode', () => {
  const environment: Environment = {
    id: 1,
    name: 'local',
    userId: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    config: {
      type: 'environment_set',
      variable_definitions: {},
      environments: {
        dev: {
          name: 'Development',
          variables: {},
          api_hosts: {}
        }
      }
    }
  };

  const preferences: ExecutionPreferences = {
    parallelExecution: true,
    stopOnError: true,
    serverCookieHandling: false,
    retryCount: 0,
    timeout: 30000
  };

  const flow: TestFlow = {
    id: '10',
    name: 'Create Order',
    apiId: 1,
    steps: [],
    flowJson: {
      parameters: [
        {
          name: 'customer_id',
          type: 'number',
          required: true,
          value: null,
          description: '',
          defaultValue: null
        }
      ],
      outputs: [
        {
          name: 'order_id',
          value: '{{response.order_id}}',
          description: '',
          isTemplate: true,
          type: 'number'
        }
      ],
      steps: []
    }
  };

  beforeEach(() => {
    flowRunnerMock.queuedResults.length = 0;
    flowRunnerMock.parameterValues.length = 0;
  });

  function createRunner(sequence: FlowSequence) {
    return new SequenceRunner({
      sequence,
      flows: [flow],
      project: {
        id: 1,
        name: 'Project',
        userId: 1,
        projectJson: {
          variables: [],
          api_hosts: {},
          environment_mappings: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      selectedEnvironment: environment,
      selectedSubEnvironment: 'dev',
      preferences,
      onLog: vi.fn()
    });
  }

  it('aggregates looped primitive outputs into arrays', async () => {
    flowRunnerMock.queuedResults.push(
      { success: true, outputs: { order_id: 101 }, responses: { endpoint: { status: 200 } } },
      { success: true, outputs: { order_id: 102 }, responses: { endpoint: { status: 200 } } },
      { success: true, outputs: { order_id: 103 }, responses: { endpoint: { status: 200 } } }
    );

    const runner = createRunner({
      id: 1,
      moduleId: 1,
      name: 'Orders',
      sequenceConfig: {
        steps: [
          {
            id: 'step-1',
            test_flow_id: 10,
            step_order: 1,
            parameter_mappings: [
              {
                flow_parameter_name: 'customer_id',
                source_type: 'loop_value',
                source_value: 'value'
              }
            ],
            loop_config: {
              enabled: true,
              source_type: 'fixed_count',
              count: 3
            }
          }
        ]
      },
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await runner.runSequence();

    expect(runner.flowResults[0].success).toBe(true);
    expect(runner.flowResults[0].outputs).toEqual({ order_id: [101, 102, 103] });
    expect(runner.flowResults[0].loop).toMatchObject({
      enabled: true,
      totalIterations: 3,
      completedIterations: 3,
      iterations: [
        {
          index: 0,
          value: 0,
          success: true,
          outputs: { order_id: 101 },
          parameterValues: { customer_id: 0 }
        },
        {
          index: 1,
          value: 1,
          success: true,
          outputs: { order_id: 102 },
          parameterValues: { customer_id: 1 }
        },
        {
          index: 2,
          value: 2,
          success: true,
          outputs: { order_id: 103 },
          parameterValues: { customer_id: 2 }
        }
      ]
    });
    expect(flowRunnerMock.parameterValues).toEqual([
      { customer_id: 0 },
      { customer_id: 1 },
      { customer_id: 2 }
    ]);
  });

  it('stops a loop on first failed iteration and preserves completed outputs', async () => {
    const failure = new Error('request failed');
    flowRunnerMock.queuedResults.push(
      { success: true, outputs: { order_id: 101 } },
      { success: false, error: failure, outputs: { order_id: 999 } },
      { success: true, outputs: { order_id: 103 } }
    );

    const runner = createRunner({
      id: 1,
      moduleId: 1,
      name: 'Orders',
      sequenceConfig: {
        steps: [
          {
            id: 'step-1',
            test_flow_id: 10,
            step_order: 1,
            parameter_mappings: [
              {
                flow_parameter_name: 'customer_id',
                source_type: 'loop_value',
                source_value: 'value'
              }
            ],
            loop_config: {
              enabled: true,
              source_type: 'fixed_count',
              count: 3
            }
          }
        ]
      },
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await runner.runSequence();

    expect(result.success).toBe(false);
    expect(runner.flowResults[0].success).toBe(false);
    expect(runner.flowResults[0].outputs).toEqual({ order_id: [101] });
    expect(runner.flowResults[0].loop).toMatchObject({
      enabled: true,
      totalIterations: 3,
      completedIterations: 1,
      failedIterationIndex: 1,
      iterations: [
        {
          index: 0,
          value: 0,
          success: true,
          outputs: { order_id: 101 }
        },
        {
          index: 1,
          value: 1,
          success: false
        }
      ]
    });
    expect(flowRunnerMock.parameterValues).toEqual([{ customer_id: 0 }, { customer_id: 1 }]);
  });
});
