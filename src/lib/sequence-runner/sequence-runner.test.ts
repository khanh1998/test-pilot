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
        },
        {
          name: 'item_id',
          type: 'number',
          required: false,
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
      httpTransport: {
        execute: vi.fn()
      },
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
                source_value: 'index',
                loop_id: 'loop_customer',
                loop_source_id: 'source_index'
              }
            ],
            loop_config: {
              enabled: true,
              root: {
                id: 'loop_customer',
                name: 'customer',
                sources: [
                  {
                    id: 'source_index',
                    alias: 'index',
                    source_type: 'fixed_count',
                    count: 3
                  }
                ]
              }
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
          label: 'customer[1]: index=0',
          success: true,
          outputs: { order_id: 101 },
          parameterValues: { customer_id: 0 }
        },
        {
          index: 1,
          label: 'customer[2]: index=1',
          success: true,
          outputs: { order_id: 102 },
          parameterValues: { customer_id: 1 }
        },
        {
          index: 2,
          label: 'customer[3]: index=2',
          success: true,
          outputs: { order_id: 103 },
          parameterValues: { customer_id: 2 }
        }
      ]
    });
    expect(flowRunnerMock.parameterValues).toEqual([
      { customer_id: 0, item_id: null },
      { customer_id: 1, item_id: null },
      { customer_id: 2, item_id: null }
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
                source_value: 'index',
                loop_id: 'loop_customer',
                loop_source_id: 'source_index'
              }
            ],
            loop_config: {
              enabled: true,
              root: {
                id: 'loop_customer',
                name: 'customer',
                sources: [
                  {
                    id: 'source_index',
                    alias: 'index',
                    source_type: 'fixed_count',
                    count: 3
                  }
                ]
              }
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
          label: 'customer[1]: index=0',
          success: true,
          outputs: { order_id: 101 }
        },
        {
          index: 1,
          label: 'customer[2]: index=1',
          success: false
        }
      ]
    });
    expect(flowRunnerMock.parameterValues).toEqual([
      { customer_id: 0, item_id: null },
      { customer_id: 1, item_id: null }
    ]);
  });

  it('executes nested loops as cartesian iterations and flattens array outputs', async () => {
    flowRunnerMock.queuedResults.push(
      { success: true, outputs: { order_id: [101, 102] } },
      { success: true, outputs: { order_id: [103] } },
      { success: true, outputs: { order_id: [201] } },
      { success: true, outputs: { order_id: [202, 203] } }
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
                source_value: 'customer',
                loop_id: 'loop_customer',
                loop_source_id: 'source_customer'
              },
              {
                flow_parameter_name: 'item_id',
                source_type: 'loop_value',
                source_value: 'item',
                loop_id: 'loop_item',
                loop_source_id: 'source_item'
              }
            ],
            loop_config: {
              enabled: true,
              root: {
                id: 'loop_customer',
                name: 'customer',
                sources: [
                  {
                    id: 'source_customer',
                    alias: 'customer',
                    source_type: 'fixed_count',
                    count: 2
                  }
                ],
                children: [
                  {
                    id: 'loop_item',
                    name: 'item',
                    sources: [
                      {
                        id: 'source_item',
                        alias: 'item',
                        source_type: 'fixed_count',
                        count: 2
                      }
                    ]
                  }
                ]
              }
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
    expect(runner.flowResults[0].outputs).toEqual({ order_id: [101, 102, 103, 201, 202, 203] });
    expect(runner.flowResults[0].loop?.totalIterations).toBe(4);
    expect(flowRunnerMock.parameterValues).toEqual([
      { customer_id: 0, item_id: 0 },
      { customer_id: 0, item_id: 1 },
      { customer_id: 1, item_id: 0 },
      { customer_id: 1, item_id: 1 }
    ]);
  });
});
