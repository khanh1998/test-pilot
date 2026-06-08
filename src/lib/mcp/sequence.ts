import { defaultTemplateFunctions } from '$lib/template/functions';
import type { TestFlow } from '$lib/types/test-flow';
import type {
  FlowLoopConfig,
  FlowParameterMapping,
  FlowSequence,
  FlowSequenceStep
} from '$lib/types/flow_sequence';

export interface SequenceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function sortedSteps(sequence: FlowSequence): FlowSequenceStep[] {
  return [...(sequence.sequenceConfig.steps ?? [])].sort((a, b) => a.step_order - b.step_order);
}

function getFlowOutputs(flow: TestFlow): Set<string> {
  return new Set((flow.flowJson?.outputs ?? []).map((output) => output.name));
}

function getFlowOutputType(flow: TestFlow, outputName: string): string | undefined {
  return flow.flowJson?.outputs?.find((output) => output.name === outputName)?.type;
}

function isPrimitiveOutputType(type: string | undefined): boolean {
  return type === 'string' || type === 'number' || type === 'boolean';
}

function getFlowParameterNames(flow: TestFlow): Set<string> {
  return new Set((flow.flowJson?.parameters ?? []).map((parameter) => parameter.name));
}

function hasFlowParameterDefault(flow: TestFlow, parameterName: string): boolean {
  const parameter = flow.flowJson?.parameters?.find((item) => item.name === parameterName);
  return (
    parameter?.defaultValue !== undefined || parameter?.value !== undefined || !parameter?.required
  );
}

function validateFunctionCall(expression: string): string | null {
  const match = expression.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/);
  if (!match) {
    return `Invalid function mapping "${expression}". Expected functionName(args).`;
  }

  const functionName = match[1];
  if (!defaultTemplateFunctions[functionName]) {
    return `Unknown function "${functionName}". Available functions: ${Object.keys(defaultTemplateFunctions).join(', ')}.`;
  }

  return null;
}

function resolveStep(
  sequence: FlowSequence,
  input: { sequenceStepId?: string; stepOrder?: number }
): FlowSequenceStep {
  const step = input.sequenceStepId
    ? sequence.sequenceConfig.steps.find((item) => item.id === input.sequenceStepId)
    : sequence.sequenceConfig.steps.find((item) => item.step_order === input.stepOrder);

  if (!step) {
    throw new Error(
      input.sequenceStepId
        ? `Sequence step ${input.sequenceStepId} was not found.`
        : `Sequence step order ${input.stepOrder} was not found.`
    );
  }

  return step;
}

export function setSequenceParameterMapping(
  sequence: FlowSequence,
  input: {
    sequenceStepId?: string;
    stepOrder?: number;
    mapping: FlowParameterMapping;
  }
): FlowSequence {
  if (!input.sequenceStepId && input.stepOrder === undefined) {
    throw new Error('sequenceStepId or stepOrder is required.');
  }

  const next = structuredClone(sequence);
  const step = resolveStep(next, input);
  const mappings = step.parameter_mappings ?? [];
  const existingIndex = mappings.findIndex(
    (item) => item.flow_parameter_name === input.mapping.flow_parameter_name
  );

  if (existingIndex >= 0) {
    mappings[existingIndex] = input.mapping;
  } else {
    mappings.push(input.mapping);
  }

  step.parameter_mappings = mappings;
  next.sequenceConfig.steps = sortedSteps(next);
  return next;
}

export function setSequenceLoopConfig(
  sequence: FlowSequence,
  input: {
    sequenceStepId?: string;
    stepOrder?: number;
    loopConfig: FlowLoopConfig;
  }
): FlowSequence {
  if (!input.sequenceStepId && input.stepOrder === undefined) {
    throw new Error('sequenceStepId or stepOrder is required.');
  }

  const next = structuredClone(sequence);
  const step = resolveStep(next, input);
  step.loop_config = input.loopConfig.enabled
    ? input.loopConfig
    : {
        ...input.loopConfig,
        enabled: false
      };
  next.sequenceConfig.steps = sortedSteps(next);
  return next;
}

export function validateFlowSequence(
  sequence: FlowSequence,
  flowsById: Map<number, TestFlow>,
  environmentVariableNames: Set<string> = new Set()
): SequenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const steps = sortedSteps(sequence);
  const stepOrders = new Set(steps.map((step) => step.step_order));

  for (const step of steps) {
    const flow = flowsById.get(step.test_flow_id);
    if (!flow) {
      errors.push(
        `Sequence step ${step.step_order} references missing test flow ${step.test_flow_id}.`
      );
      continue;
    }

    const parameterNames = getFlowParameterNames(flow);
    const mappings = step.parameter_mappings ?? [];
    const loopConfig = step.loop_config;

    if (loopConfig?.enabled) {
      if (loopConfig.source_type === 'fixed_count') {
        if (!Number.isInteger(loopConfig.count) || Number(loopConfig.count) < 1) {
          errors.push(`Sequence step ${step.step_order} loop count must be a positive integer.`);
        }
      } else if (loopConfig.source_type === 'environment_variable_array') {
        if (!loopConfig.source_value) {
          errors.push(
            `Sequence step ${step.step_order} loop source environment variable is missing.`
          );
        } else if (
          environmentVariableNames.size > 0 &&
          !environmentVariableNames.has(loopConfig.source_value)
        ) {
          errors.push(
            `Sequence step ${step.step_order} loops from unknown environment variable "${loopConfig.source_value}".`
          );
        }
      } else if (loopConfig.source_type === 'previous_output_array') {
        if (loopConfig.source_flow_step === undefined) {
          errors.push(`Sequence step ${step.step_order} loop source_flow_step is missing.`);
        } else if (!stepOrders.has(loopConfig.source_flow_step)) {
          errors.push(
            `Sequence step ${step.step_order} loops from missing flow step ${loopConfig.source_flow_step}.`
          );
        } else if (loopConfig.source_flow_step >= step.step_order) {
          errors.push(
            `Sequence step ${step.step_order} loops from step ${loopConfig.source_flow_step}, which does not run earlier.`
          );
        } else {
          const sourceStep = steps.find((item) => item.step_order === loopConfig.source_flow_step);
          const sourceFlow = sourceStep ? flowsById.get(sourceStep.test_flow_id) : undefined;
          const outputField = loopConfig.source_output_field || loopConfig.source_value;
          if (!outputField) {
            errors.push(`Sequence step ${step.step_order} loop output field is missing.`);
          } else if (sourceFlow && !getFlowOutputs(sourceFlow).has(outputField)) {
            errors.push(
              `Sequence step ${step.step_order} loops from missing output "${outputField}" on flow step ${loopConfig.source_flow_step}.`
            );
          } else if (sourceFlow && sourceStep) {
            const outputType = getFlowOutputType(sourceFlow, outputField);
            const sourceOutputIsPrimitiveArray =
              sourceStep.loop_config?.enabled && isPrimitiveOutputType(outputType);
            const sourceOutputIsDeclaredArray = outputType === 'array';

            if (!sourceOutputIsPrimitiveArray && !sourceOutputIsDeclaredArray) {
              errors.push(
                `Sequence step ${step.step_order} loop source "${outputField}" must be an array output or a primitive output from a looped previous step.`
              );
            }
          }
        }
      } else {
        errors.push(
          `Sequence step ${step.step_order} uses unsupported loop source_type "${loopConfig.source_type}".`
        );
      }
    }

    for (const mapping of mappings) {
      if (!parameterNames.has(mapping.flow_parameter_name)) {
        errors.push(
          `Sequence step ${step.step_order} maps unknown parameter "${mapping.flow_parameter_name}" on flow ${flow.name}.`
        );
      }

      if (mapping.source_type === 'environment_variable') {
        if (
          environmentVariableNames.size > 0 &&
          !environmentVariableNames.has(mapping.source_value)
        ) {
          errors.push(
            `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from unknown environment variable "${mapping.source_value}".`
          );
        }
      } else if (mapping.source_type === 'previous_output') {
        if (mapping.source_flow_step === undefined) {
          errors.push(
            `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from previous_output but source_flow_step is missing.`
          );
        } else if (!stepOrders.has(mapping.source_flow_step)) {
          errors.push(
            `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from missing flow step ${mapping.source_flow_step}.`
          );
        } else if (mapping.source_flow_step >= step.step_order) {
          errors.push(
            `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from step ${mapping.source_flow_step}, which does not run earlier.`
          );
        } else {
          const sourceStep = steps.find((item) => item.step_order === mapping.source_flow_step);
          const sourceFlow = sourceStep ? flowsById.get(sourceStep.test_flow_id) : undefined;
          const outputField = mapping.source_output_field || mapping.source_value;
          if (sourceFlow && !getFlowOutputs(sourceFlow).has(outputField)) {
            errors.push(
              `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from missing output "${outputField}" on flow step ${mapping.source_flow_step}.`
            );
          }
        }
      } else if (mapping.source_type === 'function') {
        const error = validateFunctionCall(mapping.source_value);
        if (error) {
          errors.push(`Sequence step ${step.step_order}: ${error}`);
        }
      } else if (mapping.source_type === 'static_value') {
        if (mapping.data_type && !['string', 'number', 'boolean'].includes(mapping.data_type)) {
          errors.push(
            `Sequence step ${step.step_order} static mapping for "${mapping.flow_parameter_name}" uses unsupported data_type "${mapping.data_type}".`
          );
        }
      } else if (mapping.source_type === 'loop_value') {
        if (!loopConfig?.enabled) {
          errors.push(
            `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from loop_value but loop mode is not enabled.`
          );
        }
      } else {
        errors.push(
          `Sequence step ${step.step_order} mapping for "${mapping.flow_parameter_name}" uses unsupported source_type "${mapping.source_type}".`
        );
      }
    }

    for (const parameter of flow.flowJson?.parameters ?? []) {
      const hasMapping = mappings.some((mapping) => mapping.flow_parameter_name === parameter.name);
      if (!hasMapping && !hasFlowParameterDefault(flow, parameter.name)) {
        errors.push(
          `Sequence step ${step.step_order} does not provide required parameter "${parameter.name}" for flow ${flow.name}.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function explainFlowSequence(
  sequence: FlowSequence,
  flowsById: Map<number, TestFlow>
): {
  summary: string;
  steps: string[];
  mappings: string[];
  warnings: string[];
} {
  const steps = sortedSteps(sequence);
  const warnings: string[] = [];
  const stepLines = steps.map((step) => {
    const flow = flowsById.get(step.test_flow_id);
    if (!flow) {
      warnings.push(`Step ${step.step_order} references missing flow ${step.test_flow_id}.`);
    }
    const loopConfig = step.loop_config;
    const loopText = loopConfig?.enabled
      ? loopConfig.source_type === 'fixed_count'
        ? ` (loop ${loopConfig.count ?? 0} time${loopConfig.count === 1 ? '' : 's'})`
        : loopConfig.source_type === 'environment_variable_array'
          ? ` (loop env ${loopConfig.source_value})`
          : ` (loop output ${loopConfig.source_output_field || loopConfig.source_value} from step ${loopConfig.source_flow_step})`
      : '';
    return `Step ${step.step_order}: ${flow?.name ?? `Flow ${step.test_flow_id}`}${loopText}`;
  });

  const mappings = steps.flatMap((step) =>
    (step.parameter_mappings ?? []).map((mapping) => {
      if (mapping.source_type === 'previous_output') {
        return `Step ${step.step_order}.${mapping.flow_parameter_name} <= output ${mapping.source_output_field || mapping.source_value} from step ${mapping.source_flow_step}`;
      }
      if (mapping.source_type === 'loop_value') {
        return `Step ${step.step_order}.${mapping.flow_parameter_name} <= current loop value`;
      }
      return `Step ${step.step_order}.${mapping.flow_parameter_name} <= ${mapping.source_type} ${mapping.source_value}`;
    })
  );

  return {
    summary: `${sequence.name} has ${steps.length} flow step${steps.length === 1 ? '' : 's'}.`,
    steps: stepLines,
    mappings,
    warnings
  };
}
