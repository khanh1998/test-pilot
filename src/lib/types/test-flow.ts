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
