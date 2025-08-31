export type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  example?: string;
  type?: string;
};

export type Endpoint = {
  id: number;
  apiId: number;
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestSchema?: unknown;
  responseSchema?: unknown;
};

export type StepEndpoint = {
  endpoint_id: string | number;
  api_id: string | number; // API identifier that maps to the host in settings.api_hosts
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  headers?: { name: string; value: string; enabled: boolean }[];
  transformations?: Array<{
    alias: string;      // Name used for referencing the transformed value
    expression: string; // Will store the transformation expression as string in Phase 1
  }>;
  assertions?: Array<import('$lib/assertions/types').Assertion>;
  skipDefaultStatusCheck?: boolean; // When true, skips the automatic 2xx status check
};

export type EndpointExecutionState = {
  status?: 'running' | 'completed' | 'failed' | string;
  request?: {
    url?: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
  };
  response?: {
    status?: number;
    statusText?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } | null;
  error?: string;
  timing?: number;
  transformations?: Record<string, unknown>; // Add transformations results
  assertions?: { // Add assertion results
    passed: boolean;
    results: Array<import('$lib/assertions/types').AssertionResult>;
    failureMessage?: string;
  };
};

export type ExecutionState = Record<string, EndpointExecutionState> & {
  progress?: number;
  currentStep?: number;
};

export type FlowParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  value?: unknown;
  defaultValue?: unknown;
  description?: string;
  required: boolean;
};

export type FlowOutput = {
  name: string;
  description?: string;
  value: string; // JSON template expression or hardcoded value
  isTemplate?: boolean; // Whether the value is a template expression
};

export type EnvironmentMapping = {
  environmentId: number;
  environmentName: string; // Store environment name for display
  parameterMappings: Record<string, string>; // flowParameterName -> environmentVariableName
};

export type FlowStep = {
  step_id: string;
  label: string;
  endpoints: StepEndpoint[];
  timeout?: number;
  // Other step properties
};

// Assertion types are now imported from $lib/assertions/types
import type { AssertionDataSource, AssertionType, AssertionOperator } from '$lib/assertions/types';
export type { AssertionDataSource, AssertionType, AssertionOperator };

export type ApiHostInfo = {
  url: string;
  name?: string;
  description?: string;
};

export type TestFlowData = {
  settings: {
    api_hosts?: Record<string | number, ApiHostInfo>; // New multi-API host structure
    environment?: {
      environmentId: number | null;
      subEnvironment: string | null;
    };
    linkedEnvironments?: EnvironmentMapping[]; // New: environment-parameter mappings
    // Other settings
  };
  parameters: FlowParameter[];
  outputs?: FlowOutput[]; // Add outputs array
  steps: FlowStep[];
  endpoints?: Endpoint[]; // Reference to available endpoints
};