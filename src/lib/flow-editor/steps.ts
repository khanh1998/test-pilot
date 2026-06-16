import type { TestFlowData, FlowStep, StepEndpoint } from '$lib/components/test-flows/types';

export interface AddStepInput {
  step_id?: string;
  label: string;
  endpoints?: StepEndpoint[];
  timeout?: number;
  clearCookiesBeforeExecution?: boolean;
}

export interface UpdateStepInput {
  label?: string;
  timeout?: number;
  clearCookiesBeforeExecution?: boolean;
}

export function addStep(flowData: TestFlowData, input: AddStepInput): TestFlowData {
  const nextIndex = flowData.steps.length + 1;
  const nextStep: FlowStep = {
    step_id: input.step_id ?? `step${nextIndex}`,
    label: input.label,
    endpoints: input.endpoints ?? [],
    ...(input.timeout !== undefined && { timeout: input.timeout }),
    ...(input.clearCookiesBeforeExecution !== undefined && {
      clearCookiesBeforeExecution: input.clearCookiesBeforeExecution
    })
  };
  return { ...flowData, steps: [...flowData.steps, nextStep] };
}

export function updateStep(
  flowData: TestFlowData,
  stepId: string,
  input: UpdateStepInput
): TestFlowData {
  const stepIndex = flowData.steps.findIndex((step) => step.step_id === stepId);
  if (stepIndex < 0) throw new Error(`Step ${stepId} was not found.`);

  const data = structuredClone(flowData);
  const current = data.steps[stepIndex];
  data.steps[stepIndex] = {
    ...current,
    ...(input.label !== undefined && { label: input.label }),
    ...(input.timeout !== undefined && { timeout: input.timeout }),
    ...(input.clearCookiesBeforeExecution !== undefined && {
      clearCookiesBeforeExecution: input.clearCookiesBeforeExecution
    })
  };
  return data;
}

export function removeStep(flowData: TestFlowData, stepId: string): TestFlowData {
  const steps = flowData.steps.filter((step) => step.step_id !== stepId);
  if (steps.length === flowData.steps.length) throw new Error(`Step ${stepId} was not found.`);
  return { ...flowData, steps };
}
