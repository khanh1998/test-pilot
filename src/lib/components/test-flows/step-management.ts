import type { FlowStep, TestFlowData } from './types';
import { generateStepId, generateStepIdBetween } from './step-id-utils';

/**
 * Step Management Service
 * Provides utilities for CRUD operations on test flow steps
 */

/**
 * Add a new step at the end of the flow
 */
export function addNewStep(flowData: TestFlowData): TestFlowData {
  const allStepIds = flowData.steps.map(s => s.step_id);
  const lastStepId = flowData.steps.length > 0 ? flowData.steps[flowData.steps.length - 1].step_id : null;
  const newStepId = generateStepId(allStepIds, lastStepId, null);

  const newStep: FlowStep = {
    step_id: newStepId,
    label: `Step ${newStepId}`,
    endpoints: [],
    clearCookiesBeforeExecution: false
  };

  return {
    ...flowData,
    steps: [...flowData.steps, newStep]
  };
}

/**
 * Insert a new step after a specific step index
 */
export function insertStepAfter(flowData: TestFlowData, afterStepIndex: number): TestFlowData {
  const newStepId = generateStepIdBetween(flowData.steps, afterStepIndex, afterStepIndex + 1);
  
  const newStep: FlowStep = {
    step_id: newStepId,
    label: `Step ${newStepId}`,
    endpoints: [],
    clearCookiesBeforeExecution: false
  };

  const newSteps = [...flowData.steps];
  newSteps.splice(afterStepIndex + 1, 0, newStep);

  return {
    ...flowData,
    steps: newSteps
  };
}

/**
 * Insert a new step at the beginning of the flow
 */
export function insertStepAtBeginning(flowData: TestFlowData): TestFlowData {
  const allStepIds = flowData.steps.map(s => s.step_id);
  const newStepId = generateStepId(allStepIds, null, flowData.steps[0]?.step_id || null);
  
  const newStep: FlowStep = {
    step_id: newStepId,
    label: `Step ${newStepId}`,
    endpoints: [],
    clearCookiesBeforeExecution: false
  };

  return {
    ...flowData,
    steps: [newStep, ...flowData.steps]
  };
}

/**
 * Remove a step from the flow
 */
export function removeStep(flowData: TestFlowData, stepIndex: number): TestFlowData {
  const newSteps = [...flowData.steps];
  newSteps.splice(stepIndex, 1);

  return {
    ...flowData,
    steps: newSteps
  };
}

/**
 * Move a step up or down in the flow
 */
export function moveStep(
  flowData: TestFlowData, 
  stepIndex: number, 
  direction: 'up' | 'down'
): TestFlowData {
  const newSteps = [...flowData.steps];

  if (direction === 'up' && stepIndex > 0) {
    const temp = newSteps[stepIndex - 1];
    newSteps[stepIndex - 1] = newSteps[stepIndex];
    newSteps[stepIndex] = temp;
  } else if (direction === 'down' && stepIndex < newSteps.length - 1) {
    const temp = newSteps[stepIndex + 1];
    newSteps[stepIndex + 1] = newSteps[stepIndex];
    newSteps[stepIndex] = temp;
  }

  return {
    ...flowData,
    steps: newSteps
  };
}

/**
 * Remove an endpoint from a specific step
 */
export function removeEndpoint(
  flowData: TestFlowData, 
  stepIndex: number, 
  endpointIndex: number
): TestFlowData {
  const newSteps = [...flowData.steps];
  const step = { ...newSteps[stepIndex] };
  step.endpoints = [...step.endpoints];
  step.endpoints.splice(endpointIndex, 1);
  newSteps[stepIndex] = step;

  return {
    ...flowData,
    steps: newSteps
  };
}
