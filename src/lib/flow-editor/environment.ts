import type { TestFlowData, EnvironmentMapping } from '$lib/components/test-flows/types';

export interface LinkEnvironmentInput {
  environmentId: number;
  environmentName: string;
  selectedSubEnvironment?: string;
  parameterMappings?: Record<string, string>;
}

export function linkEnvironmentToFlowData(
  flowData: TestFlowData,
  input: LinkEnvironmentInput
): TestFlowData {
  const data = structuredClone(flowData);
  data.settings.environment = {
    environmentId: input.environmentId,
    subEnvironment: input.selectedSubEnvironment ?? null
  };
  const linkedEnvironment: EnvironmentMapping = {
    environmentId: input.environmentId,
    environmentName: input.environmentName,
    parameterMappings: input.parameterMappings ?? {}
  };
  data.settings.linkedEnvironment = linkedEnvironment;
  return data;
}
