import { addStep, updateStep, removeStep } from '$lib/flow-editor/steps';
import type { AddStepInput, UpdateStepInput } from '$lib/flow-editor/steps';
import type { TestFlowData } from '$lib/components/test-flows/types';
import { applyFlowEdit } from './apply_flow_edit';
import type { TestFlowRow } from './apply_flow_edit';

export type { AddStepInput, UpdateStepInput };

export async function addStepToTestFlow(
  flowId: number,
  userId: number,
  input: AddStepInput
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) => addStep(data, input));
}

export async function updateStepInTestFlow(
  flowId: number,
  userId: number,
  stepId: string,
  input: UpdateStepInput
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) => updateStep(data, stepId, input));
}

export async function removeStepFromTestFlow(
  flowId: number,
  userId: number,
  stepId: string
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) => removeStep(data, stepId));
}
