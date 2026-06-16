import type { TestFlowData, FlowOutput } from '$lib/components/test-flows/types';

export function setFlowOutput(flowData: TestFlowData, output: FlowOutput): TestFlowData {
  const data = structuredClone(flowData);
  const outputs = data.outputs ?? [];
  const normalized: FlowOutput = { ...output };
  if (normalized.type === 'array') {
    normalized.arrayItemType = normalized.arrayItemType ?? 'unknown';
  } else {
    delete normalized.arrayItemType;
  }
  const idx = outputs.findIndex((o) => o.name === output.name);
  if (idx >= 0) {
    outputs[idx] = normalized;
  } else {
    outputs.push(normalized);
  }
  data.outputs = outputs;
  return data;
}
