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
  store_response_as?: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  headers?: { name: string; value: string; enabled: boolean }[];
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
};

export type ExecutionState = Record<string, EndpointExecutionState> & {
  progress?: number;
  currentStep?: number;
};

export type FlowVariable = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  value?: unknown;
  defaultValue?: unknown;
  description?: string;
  required: boolean;
};

export type FlowStep = {
  step_id: string;
  label: string;
  endpoints: StepEndpoint[];
  timeout?: number;
  // Other step properties
};

export type FlowAssertion = {
  id: string;
  step_id: string;
  endpoint_index?: number;
  target: string;
  condition: string;
  expected_value: unknown;
  // Other assertion properties
};

export type TestFlowData = {
  settings: {
    api_host: string;
    // Other settings
  };
  variables: FlowVariable[];
  steps: FlowStep[];
  assertions: FlowAssertion[];
  endpoints?: Endpoint[]; // Reference to available endpoints
};