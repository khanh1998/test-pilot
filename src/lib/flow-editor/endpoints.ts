import type { TestFlowData } from '$lib/components/test-flows/types';
import type { Assertion } from '$lib/assertions/types';

export interface EndpointPatch {
  body?: Record<string, unknown>;
  headers?: Array<{ name: string; value: string; enabled?: boolean }>;
  queryParams?: Record<string, string | string[]>;
  pathParams?: Record<string, string>;
  assertions?: Assertion[];
  transformations?: Array<{ alias: string; expression: string }>;
  skipDefaultStatusCheck?: boolean;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function patchEndpoint(
  flowData: TestFlowData,
  stepId: string,
  endpointIndex: number,
  patch: EndpointPatch
): TestFlowData {
  const data = structuredClone(flowData);
  const step = data.steps.find((s) => s.step_id === stepId);
  if (!step) throw new Error(`Step ${stepId} was not found.`);
  const endpoint = step.endpoints[endpointIndex];
  if (!endpoint) throw new Error(`Endpoint index ${endpointIndex} was not found on step ${stepId}.`);

  if (patch.body !== undefined) {
    const existing =
      endpoint.body && typeof endpoint.body === 'object' && !Array.isArray(endpoint.body)
        ? (endpoint.body as Record<string, unknown>)
        : {};
    endpoint.body = deepMerge(existing, patch.body);
  }

  if (patch.headers !== undefined) {
    const existing = endpoint.headers ?? [];
    const merged = [...existing];
    for (const header of patch.headers) {
      const idx = merged.findIndex((h) => h.name.toLowerCase() === header.name.toLowerCase());
      const entry = { name: header.name, value: header.value, enabled: header.enabled ?? true };
      if (idx >= 0) {
        merged[idx] = entry;
      } else {
        merged.push(entry);
      }
    }
    endpoint.headers = merged;
  }

  if (patch.queryParams !== undefined) {
    endpoint.queryParams = { ...(endpoint.queryParams ?? {}), ...patch.queryParams };
  }

  if (patch.pathParams !== undefined) {
    endpoint.pathParams = { ...(endpoint.pathParams ?? {}), ...patch.pathParams };
  }

  if (patch.assertions !== undefined) {
    endpoint.assertions = patch.assertions;
  }

  if (patch.transformations !== undefined) {
    endpoint.transformations = patch.transformations;
  }

  if (patch.skipDefaultStatusCheck !== undefined) {
    endpoint.skipDefaultStatusCheck = patch.skipDefaultStatusCheck;
  }

  return data;
}
