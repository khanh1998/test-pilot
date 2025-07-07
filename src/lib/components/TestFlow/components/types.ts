export type Parameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  example?: string;
  type?: string;
};

export type Endpoint = {
  id: string | number;
  path: string;
  method: string;
  parameters?: Parameter[];
  requestSchema?: any;
  responseSchema?: any;
};

export type StepEndpoint = {
  endpoint_id: string | number;
  store_response_as?: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
  headers?: {name: string; value: string; enabled: boolean}[];
};

export type ExecutionState = Record<string, {
  status?: 'running' | 'completed' | 'failed';
  request?: {
    url?: string;
    body?: any;
    headers?: Record<string, string>;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
  };
  response?: {
    status?: number;
    statusText?: string;
    body?: any;
    headers?: Record<string, string>;
  };
  timing?: number;
}>;
