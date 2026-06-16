import type { Endpoint } from '$lib/types/test-flow';

export interface RequestCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
}

export interface FlowHttpRequest {
  endpointDef: Endpoint;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeout: number;
  cookieStore: Map<string, RequestCookie[]>;
  endpointId: string;
  useServerCookieHandling: boolean;
  addLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
}

export interface FlowHttpTransport {
  execute(request: FlowHttpRequest): Promise<Response>;
}
