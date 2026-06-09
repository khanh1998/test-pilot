import { defaultTemplateFunctions } from '$lib/template/functions';
import type { TestFlow } from '$lib/types/test-flow';
import type {
  FlowLoopDefinition,
  FlowLoopSource,
  FlowLoopConfig,
  FlowParameterMapping,
  FlowSequence,
  FlowSequenceStep
} from '$lib/types/flow_sequence';
import { normalizeFlowLoopConfig } from '$lib/types/flow_sequence';

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

function getFlowOutputDefinition(flow: TestFlow, outputName: string) {
  return flow.flowJson?.outputs?.find((output) => output.name === outputName);
}

function isPrimitiveOutputType(type: string | undefined): boolean {
  return type === 'string' || type === 'number' || type === 'boolean';
}

function isPrimitiveArrayOutput(output: ReturnType<typeof getFlowOutputDefinition>): boolean {
  return output?.type === 'array' && isPrimitiveOutputType(output.arrayItemType);
}

function flattenLoopDefinitions(root?: FlowLoopDefinition): FlowLoopDefinition[] {
  if (!root) return [];
  return [root, ...(root.children ?? []).flatMap((child) => flattenLoopDefinitions(child))];
}

function getLoopDepth(loop: FlowLoopDefinition): number {
  const childDepth = Math.max(0, ...(loop.children ?? []).map(getLoopDepth));
  return 1 + childDepth;
}

function hasDuplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
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
    const loopConfig = normalizeFlowLoopConfig(step.loop_config);

    const loopDefinitions = flattenLoopDefinitions(loopConfig.root);

    if (loopConfig?.enabled) {
      if (!loopConfig.root) {
        errors.push(`Sequence step ${step.step_order} loop mode requires a root loop.`);
      } else {
        validateLoopTree(
          loopConfig.root,
          step,
          steps,
          stepOrders,
          flowsById,
          environmentVariableNames,
          errors
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
        } else {
          const fallbackLoop = loopDefinitions.length === 1 ? loopDefinitions[0] : undefined;
          const fallbackSource =
            fallbackLoop?.sources.length === 1 ? fallbackLoop.sources[0] : undefined;
          const loopId = mapping.loop_id || fallbackLoop?.id;
          const loopSourceId = mapping.loop_source_id || fallbackSource?.id;

          if (!loopId || !loopSourceId) {
            errors.push(
              `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from loop_value but loop_id or loop_source_id is missing.`
            );
            continue;
          }

          const targetLoop = loopDefinitions.find((loop) => loop.id === loopId);
          const targetSource = targetLoop?.sources.find((source) => source.id === loopSourceId);
          if (!targetLoop || !targetSource) {
            errors.push(
              `Sequence step ${step.step_order} maps "${mapping.flow_parameter_name}" from an unknown loop value.`
            );
          }
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

function validateLoopTree(
  root: FlowLoopDefinition,
  step: FlowSequenceStep,
  steps: FlowSequenceStep[],
  stepOrders: Set<number>,
  flowsById: Map<number, TestFlow>,
  environmentVariableNames: Set<string>,
  errors: string[]
) {
  const loops = flattenLoopDefinitions(root);
  if (getLoopDepth(root) > 2) {
    errors.push(`Sequence step ${step.step_order} loop nesting depth cannot exceed 2.`);
  }
  if ((root.children ?? []).length > 1) {
    errors.push(`Sequence step ${step.step_order} loop can have at most one nested loop.`);
  }
  for (const loop of loops) {
    if ((loop.children ?? []).length > 1) {
      errors.push(
        `Sequence step ${step.step_order} loop "${loop.name}" can have at most one child.`
      );
    }
  }
  if (hasDuplicate(loops.map((loop) => loop.name).filter(Boolean))) {
    errors.push(`Sequence step ${step.step_order} loop names must be unique.`);
  }

  for (const loop of loops) {
    if (!loop.name?.trim()) {
      errors.push(`Sequence step ${step.step_order} has a loop with missing name.`);
    }
    if (!loop.sources?.length) {
      errors.push(
        `Sequence step ${step.step_order} loop "${loop.name}" must have at least one source.`
      );
      continue;
    }
    if (hasDuplicate(loop.sources.map((source) => source.alias).filter(Boolean))) {
      errors.push(
        `Sequence step ${step.step_order} loop "${loop.name}" source aliases must be unique.`
      );
    }
    for (const source of loop.sources) {
      validateLoopSource(
        source,
        loop,
        step,
        steps,
        stepOrders,
        flowsById,
        environmentVariableNames,
        errors
      );
    }
  }
}

function validateLoopSource(
  source: FlowLoopSource,
  loop: FlowLoopDefinition,
  step: FlowSequenceStep,
  steps: FlowSequenceStep[],
  stepOrders: Set<number>,
  flowsById: Map<number, TestFlow>,
  environmentVariableNames: Set<string>,
  errors: string[]
) {
  if (!source.alias?.trim()) {
    errors.push(
      `Sequence step ${step.step_order} loop "${loop.name}" has a source with missing alias.`
    );
  }
  if (source.source_type === 'fixed_count') {
    if (!Number.isInteger(source.count) || Number(source.count) < 1) {
      errors.push(
        `Sequence step ${step.step_order} loop source "${source.alias}" count must be a positive integer.`
      );
    }
    return;
  }
  if (source.source_type === 'environment_variable_array') {
    if (!source.source_value) {
      errors.push(
        `Sequence step ${step.step_order} loop source "${source.alias}" environment variable is missing.`
      );
    } else if (
      environmentVariableNames.size > 0 &&
      !environmentVariableNames.has(source.source_value)
    ) {
      errors.push(
        `Sequence step ${step.step_order} loop source "${source.alias}" uses unknown environment variable "${source.source_value}".`
      );
    }
    return;
  }
  if (source.source_type !== 'previous_output_array') {
    errors.push(
      `Sequence step ${step.step_order} loop source "${source.alias}" uses unsupported source_type "${source.source_type}".`
    );
    return;
  }

  if (source.source_flow_step === undefined) {
    errors.push(
      `Sequence step ${step.step_order} loop source "${source.alias}" source_flow_step is missing.`
    );
  } else if (!stepOrders.has(source.source_flow_step)) {
    errors.push(
      `Sequence step ${step.step_order} loop source "${source.alias}" uses missing flow step ${source.source_flow_step}.`
    );
  } else if (source.source_flow_step >= step.step_order) {
    errors.push(
      `Sequence step ${step.step_order} loop source "${source.alias}" uses step ${source.source_flow_step}, which does not run earlier.`
    );
  } else {
    const sourceStep = steps.find((item) => item.step_order === source.source_flow_step);
    const sourceFlow = sourceStep ? flowsById.get(sourceStep.test_flow_id) : undefined;
    const outputField = source.source_output_field || source.source_value;
    if (!outputField) {
      errors.push(
        `Sequence step ${step.step_order} loop source "${source.alias}" output field is missing.`
      );
    } else if (sourceFlow && !getFlowOutputs(sourceFlow).has(outputField)) {
      errors.push(
        `Sequence step ${step.step_order} loop source "${source.alias}" uses missing output "${outputField}" on flow step ${source.source_flow_step}.`
      );
    } else if (sourceFlow && sourceStep) {
      const outputDefinition = getFlowOutputDefinition(sourceFlow, outputField);
      const sourceOutputIsPrimitiveArray =
        sourceStep.loop_config?.enabled &&
        (isPrimitiveOutputType(outputDefinition?.type) || isPrimitiveArrayOutput(outputDefinition));
      const sourceOutputIsDeclaredPrimitiveArray = isPrimitiveArrayOutput(outputDefinition);

      if (!sourceOutputIsPrimitiveArray && !sourceOutputIsDeclaredPrimitiveArray) {
        errors.push(
          `Sequence step ${step.step_order} loop source "${source.alias}" must be a primitive array output or a primitive output from a looped previous step.`
        );
      }
    }
  }
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
    const loopConfig = normalizeFlowLoopConfig(step.loop_config);
    const loopText =
      loopConfig?.enabled && loopConfig.root ? ` (loop ${explainLoop(loopConfig.root)})` : '';
    return `Step ${step.step_order}: ${flow?.name ?? `Flow ${step.test_flow_id}`}${loopText}`;
  });

  const mappings = steps.flatMap((step) =>
    (step.parameter_mappings ?? []).map((mapping) => {
      if (mapping.source_type === 'previous_output') {
        return `Step ${step.step_order}.${mapping.flow_parameter_name} <= output ${mapping.source_output_field || mapping.source_value} from step ${mapping.source_flow_step}`;
      }
      if (mapping.source_type === 'loop_value') {
        const loops = flattenLoopDefinitions(normalizeFlowLoopConfig(step.loop_config).root);
        const fallbackLoop = loops.length === 1 ? loops[0] : undefined;
        const fallbackSource =
          fallbackLoop?.sources.length === 1 ? fallbackLoop.sources[0] : undefined;
        const loop = loops.find((item) => item.id === (mapping.loop_id || fallbackLoop?.id));
        const source = loop?.sources.find(
          (item) => item.id === (mapping.loop_source_id || fallbackSource?.id)
        );
        return `Step ${step.step_order}.${mapping.flow_parameter_name} <= loop ${loop?.name ?? mapping.loop_id}.${source?.alias ?? mapping.loop_source_id}`;
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

function explainLoop(loop: FlowLoopDefinition): string {
  const aliases = loop.sources.map((source) => source.alias).join(',');
  const current = `${loop.name}[${aliases}]`;
  const child = loop.children?.[0];
  return child ? `${current} -> ${explainLoop(child)}` : current;
}
