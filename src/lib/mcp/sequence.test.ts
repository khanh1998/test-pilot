import { describe, expect, it } from 'vitest';
import type { TestFlow } from '$lib/types/test-flow';
import type { FlowSequence } from '$lib/types/flow_sequence';
import { explainFlowSequence, setSequenceParameterMapping, validateFlowSequence } from './sequence';

type FlowParamFixture = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  required: boolean;
  description: string;
};

type FlowOutputFixture = {
  name: string;
  value: string;
  isTemplate: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'unknown' | 'array' | 'null';
};

function flow(
  id: number,
  name: string,
  parameters: FlowParamFixture[] = [],
  outputs: FlowOutputFixture[] = []
): TestFlow {
  return {
    id: String(id),
    name,
    apiId: 1,
    steps: [],
    flowJson: {
      steps: [],
      parameters,
      outputs
    }
  } as unknown as TestFlow;
}

function sequence(): FlowSequence {
  return {
    id: 10,
    moduleId: 2,
    name: 'Order sequence',
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    sequenceConfig: {
      steps: [
        {
          id: 'seq-step-1',
          test_flow_id: 1,
          step_order: 1,
          parameter_mappings: []
        },
        {
          id: 'seq-step-2',
          test_flow_id: 2,
          step_order: 2,
          parameter_mappings: []
        }
      ]
    }
  };
}

describe('mcp sequence helpers', () => {
  it('maps parameters from previous outputs and functions', () => {
    const updated = setSequenceParameterMapping(sequence(), {
      stepOrder: 2,
      mapping: {
        flow_parameter_name: 'order_id',
        source_type: 'previous_output',
        source_value: 'order_id',
        source_flow_step: 1,
        source_output_field: 'order_id'
      }
    });

    const withFunction = setSequenceParameterMapping(updated, {
      stepOrder: 2,
      mapping: {
        flow_parameter_name: 'request_id',
        source_type: 'function',
        source_value: 'uuid()'
      }
    });

    expect(withFunction.sequenceConfig.steps[1].parameter_mappings).toHaveLength(2);
  });

  it('validates valid environment, previous output, and function mappings', () => {
    const seq = setSequenceParameterMapping(
      setSequenceParameterMapping(sequence(), {
        stepOrder: 1,
        mapping: {
          flow_parameter_name: 'token',
          source_type: 'environment_variable',
          source_value: 'TOKEN'
        }
      }),
      {
        stepOrder: 2,
        mapping: {
          flow_parameter_name: 'order_id',
          source_type: 'previous_output',
          source_value: 'order_id',
          source_flow_step: 1
        }
      }
    );

    const flowsById = new Map<number, TestFlow>([
      [
        1,
        flow(
          1,
          'Create order',
          [{ name: 'token', type: 'string', required: true, description: '' }],
          [{ name: 'order_id', value: '{{res:step1-0.$.id}}', isTemplate: true, type: 'string' }]
        )
      ],
      [
        2,
        flow(2, 'Get order', [
          { name: 'order_id', type: 'string', required: true, description: '' }
        ])
      ]
    ]);

    const result = validateFlowSequence(seq, flowsById, new Set(['TOKEN']));
    expect(result.valid).toBe(true);
  });

  it('rejects future output mappings and missing output names', () => {
    const seq = setSequenceParameterMapping(sequence(), {
      stepOrder: 1,
      mapping: {
        flow_parameter_name: 'token',
        source_type: 'previous_output',
        source_value: 'missing',
        source_flow_step: 2
      }
    });

    const flowsById = new Map<number, TestFlow>([
      [
        1,
        flow(1, 'Create order', [
          { name: 'token', type: 'string', required: true, description: '' }
        ])
      ],
      [
        2,
        flow(
          2,
          'Get order',
          [],
          [{ name: 'order_id', value: '{{res:step1-0.$.id}}', isTemplate: true, type: 'string' }]
        )
      ]
    ]);

    const result = validateFlowSequence(seq, flowsById);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('does not run earlier');
  });

  it('reports required unmapped parameters and invalid functions', () => {
    const seq = setSequenceParameterMapping(sequence(), {
      stepOrder: 2,
      mapping: {
        flow_parameter_name: 'request_id',
        source_type: 'function',
        source_value: 'missingFunction()'
      }
    });

    const flowsById = new Map<number, TestFlow>([
      [1, flow(1, 'Create order')],
      [
        2,
        flow(2, 'Get order', [
          { name: 'order_id', type: 'string', required: true, description: '' },
          { name: 'request_id', type: 'string', required: true, description: '' }
        ])
      ]
    ]);

    const result = validateFlowSequence(seq, flowsById);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('required parameter "order_id"');
    expect(result.errors.join(' ')).toContain('Unknown function');
  });

  it('explains sequence mappings', () => {
    const seq = setSequenceParameterMapping(sequence(), {
      stepOrder: 2,
      mapping: {
        flow_parameter_name: 'order_id',
        source_type: 'previous_output',
        source_value: 'order_id',
        source_flow_step: 1
      }
    });

    const explanation = explainFlowSequence(
      seq,
      new Map([
        [1, flow(1, 'Create order')],
        [2, flow(2, 'Get order')]
      ])
    );

    expect(explanation.summary).toContain('2 flow steps');
    expect(explanation.mappings.join(' ')).toContain('output order_id from step 1');
  });
});
