export interface Endpoint {
  method: string;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}

export interface StepEndpoint extends Endpoint {
  id: string;
  name: string;
  description?: string;
}

export interface TestFlow {
  id: string;
  name: string;
  description?: string;
  apiId: number;
  steps: TestFlowStep[];
  flowJson?: TestFlowJson; // Add the flowJson property
  createdAt?: string;
  updatedAt?: string;
}

export interface TestFlowStep {
  id: string;
  name: string;
  description?: string;
  endpoint: Endpoint;
  assertions?: Assertion[];
}

export interface Assertion {
  id: string;
  property: string;
  operator: string;
  value: any;
}

export interface TestFlowExecution {
  id: string;
  testFlowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: TestFlowStepExecution[];
  startTime: string;
  endTime?: string;
}

export interface TestFlowStepExecution {
  id: string;
  stepId: string;
  status: 'pending' | 'success' | 'failed';
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  };
  assertions?: AssertionResult[];
  startTime: string;
  endTime?: string;
}

export interface AssertionResult extends Assertion {
  passed: boolean;
  actual?: any;
}


// Define TestFlow type based on the JSON schema structure
export interface TestFlowJson {
  steps: Array<{
    label: string;
    step_id: string;
    endpoints: Array<{
      body: Record<string, string | number | boolean | null> | null;
      api_id: number;
      headers: Array<{
        name: string;
        value: string;
        enabled: boolean;
      }> | null;
      assertions: Array<{
        id: string;
        data_id: string;
        enabled: boolean;
        operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'greater_than' | 'less_than' |
                 'starts_with' | 'ends_with' | 'matches_regex' | 'is_empty' | 'greater_than_or_equal' |
                 'less_than_or_equal' | 'between' | 'not_between' | 'has_length' | 'length_greater_than' |
                 'length_less_than' | 'contains_all' | 'contains_any' | 'is_type' | 'is_null' | 'is_not_null';
        data_source: 'response' | 'transformed_data';
        assertion_type: 'status_code' | 'json_body' | 'response_time' | 'header';
        expected_value: string | number | boolean | Array<string | number | boolean | null> | null;
        expected_value_type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'null';
      }> | null;
      pathParams: Record<string, string | number | boolean | null> | null;
      endpoint_id: number;
      queryParams: Record<string, string | number | boolean | null> | null;
      transformations: Array<{
        alias: string;
        expression: string;
      }> | null;
    }>;
  }>;
  parameters: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'null';
    value: string | number | boolean | Array<string | number | boolean | null> | null;
    required: boolean;
    description: string;
    defaultValue: string | number | boolean | Array<string | number | boolean | null> | null;
  }>;
  outputs?: Array<{
    name: string;
    value: string;
    description?: string;
    isTemplate: boolean;
  }>;
  settings?: {
    api_hosts: Record<string, {
      url: string;
      name: string;
    }>;
    environment_id?: number; // Link to environment
  };
}
