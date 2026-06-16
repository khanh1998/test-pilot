import type { TestFlowData, FlowParameter } from '$lib/components/test-flows/types';

export function addFlowParameter(flowData: TestFlowData, parameter: FlowParameter): TestFlowData {
  const data = structuredClone(flowData);
  const idx = data.parameters.findIndex((p) => p.name === parameter.name);
  if (idx >= 0) {
    data.parameters[idx] = parameter;
  } else {
    data.parameters.push(parameter);
  }
  return data;
}
