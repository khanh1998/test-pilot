/**
 * Types for the proxy API
 */

// Cookie object with all its properties
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Request to proxy an API call
export interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | null;
  cookies?: Cookie[]; // Client-provided cookies to send to the API
}

// Response from the proxy API
export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  cookies: Cookie[]; // Cookies extracted from Set-Cookie headers
}
