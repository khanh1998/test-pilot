import { patchEndpoint } from '$lib/flow-editor/endpoints';
import type { EndpointPatch } from '$lib/flow-editor/endpoints';
import type { TestFlowData } from '$lib/components/test-flows/types';
import { applyFlowEdit } from './apply_flow_edit';
import type { TestFlowRow } from './apply_flow_edit';

export type { EndpointPatch };

export async function patchEndpointInTestFlow(
  flowId: number,
  userId: number,
  stepId: string,
  endpointIndex: number,
  patch: EndpointPatch
): Promise<TestFlowRow> {
  return applyFlowEdit(flowId, userId, (data: TestFlowData) =>
    patchEndpoint(data, stepId, endpointIndex, patch)
  );
}
