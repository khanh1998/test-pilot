import type {
  StepEndpoint,
  TestFlowData,
  ApiHostInfo
} from '$lib/components/test-flows/types';
import type { Environment } from '$lib/types/environment';

export type ApiHostSource = 'environment' | 'flow';

export interface ResolvedApiHost {
  apiId: string;
  url: string;
  source: ApiHostSource;
  environmentName?: string;
  subEnvironment?: string;
}

export interface ApiHostCoverage {
  hasRequiredHosts: boolean;
  requiredApiIds: string[];
  missingApiIds: string[];
  resolvedHosts: Record<string, ResolvedApiHost>;
}

interface ResolveApiHostInput {
  endpoint: Pick<StepEndpoint, 'api_id'>;
  flowData: Pick<TestFlowData, 'settings'>;
  environment?: Environment | null;
  selectedSubEnvironment?: string | null;
}

interface ResolveApiHostCoverageInput {
  flowData: Pick<TestFlowData, 'settings' | 'steps'>;
  environment?: Environment | null;
  selectedSubEnvironment?: string | null;
}

function normalizeApiId(apiId: string | number | null | undefined): string | null {
  if (apiId === null || apiId === undefined) {
    return null;
  }

  const normalized = String(apiId).trim();
  return normalized === '' ? null : normalized;
}

function isUsableUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function getSelectedSubEnvironment(
  flowData: Pick<TestFlowData, 'settings'>,
  selectedSubEnvironment?: string | null
): string | null {
  return selectedSubEnvironment ?? flowData.settings.environment?.subEnvironment ?? null;
}

function getFlowHost(apiHosts: TestFlowData['settings']['api_hosts'], apiId: string): string | null {
  const hostInfo = apiHosts?.[apiId] as ApiHostInfo | undefined;
  return isUsableUrl(hostInfo?.url) ? hostInfo.url.trim() : null;
}

export function resolveEndpointApiHost({
  endpoint,
  flowData,
  environment = null,
  selectedSubEnvironment = null
}: ResolveApiHostInput): ResolvedApiHost | null {
  const apiId = normalizeApiId(endpoint.api_id);
  if (!apiId) {
    return null;
  }

  const subEnvironment = getSelectedSubEnvironment(flowData, selectedSubEnvironment);
  const envHost =
    environment && subEnvironment
      ? environment.config.environments[subEnvironment]?.api_hosts?.[apiId]
      : null;

  if (isUsableUrl(envHost)) {
    return {
      apiId,
      url: envHost.trim(),
      source: 'environment',
      environmentName: environment?.name,
      subEnvironment: subEnvironment ?? undefined
    };
  }

  const flowHost = getFlowHost(flowData.settings.api_hosts, apiId);
  if (flowHost) {
    return {
      apiId,
      url: flowHost,
      source: 'flow'
    };
  }

  return null;
}

export function resolveApiHostCoverage({
  flowData,
  environment = null,
  selectedSubEnvironment = null
}: ResolveApiHostCoverageInput): ApiHostCoverage {
  const requiredApiIds = Array.from(
    new Set(
      (flowData.steps || [])
        .flatMap((step) => step.endpoints || [])
        .map((endpoint) => normalizeApiId(endpoint.api_id))
        .filter((apiId): apiId is string => apiId !== null)
    )
  );

  const resolvedHosts: Record<string, ResolvedApiHost> = {};
  const missingApiIds: string[] = [];

  for (const apiId of requiredApiIds) {
    const resolvedHost = resolveEndpointApiHost({
      endpoint: { api_id: apiId },
      flowData,
      environment,
      selectedSubEnvironment
    });

    if (resolvedHost) {
      resolvedHosts[apiId] = resolvedHost;
    } else {
      missingApiIds.push(apiId);
    }
  }

  return {
    hasRequiredHosts: requiredApiIds.length > 0 && missingApiIds.length === 0,
    requiredApiIds,
    missingApiIds,
    resolvedHosts
  };
}
