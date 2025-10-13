import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ProxyRequest, ProxyResponse, Cookie } from '../types';

/**
 * Server-side proxy to handle requests with cookie management
 * This endpoint forwards the client's request to the target API
 * and passes back cookies that would otherwise be restricted by CORS
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    const errorResponse: ProxyResponse = {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      body: { 
        error: 'Authentication required to use the proxy service',
        errorSource: 'proxy',
        message: 'You must be logged in to make proxied requests'
      },
      cookies: []
    };
    return json(errorResponse, { status: 401 });
  }
  try {
    // Parse the request body to get the original request details
    const requestData = (await request.json()) as ProxyRequest;
    const { url, method, headers, body, cookies: requestCookies } = requestData;

    if (!url) {
      const errorResponse: ProxyResponse = {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' },
        body: { 
          error: 'Missing required parameter',
          errorSource: 'proxy',
          message: 'URL parameter is required in the request body'
        },
        cookies: []
      };
      return json(errorResponse, { status: 400 });
    }

    // Security checks to prevent SSRF attacks
    try {
      const targetUrl = new URL(url);

      // Block requests to internal/private networks
      const hostname = targetUrl.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        const errorResponse: ProxyResponse = {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'content-type': 'application/json' },
          body: { 
            error: 'Request blocked by security policy',
            errorSource: 'proxy',
            message: 'Requests to internal/private networks are not allowed for security reasons',
            blockedHost: hostname
          },
          cookies: []
        };
        return json(errorResponse, { status: 403 });
      }

      // Only allow http and https schemes
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        const errorResponse: ProxyResponse = {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'content-type': 'application/json' },
          body: { 
            error: 'Unsupported protocol',
            errorSource: 'proxy',
            message: 'Only HTTP and HTTPS protocols are supported',
            providedProtocol: targetUrl.protocol
          },
          cookies: []
        };
        return json(errorResponse, { status: 403 });
      }
    } catch (_error: unknown) {
      const errorResponse: ProxyResponse = {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' },
        body: { 
          error: 'Invalid URL format',
          errorSource: 'proxy',
          message: 'The provided URL could not be parsed. Please check the URL format',
          details: _error instanceof Error ? _error.message : 'Malformed URL'
        },
        cookies: []
      };
      return json(errorResponse, { status: 400 });
    }

    // Create headers for the forwarded request
    const proxyHeaders = new Headers(headers || {});

    // Add any client-provided cookies to the request
    const targetUrl = new URL(url);

    if (requestCookies && requestCookies.length > 0) {
      const cookieHeader = requestCookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      if (cookieHeader) {
        proxyHeaders.set('Cookie', cookieHeader);
      }
    }

    // Make the actual request to the target API
    let proxyResponse;
    const reqInit: RequestInit = {
      method,
      headers: proxyHeaders,
      body: body ? body : undefined,
      redirect: 'follow',
      // Set a reasonable timeout to avoid hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
    };

    try {
      proxyResponse = await fetch(url, reqInit);
    } catch (_error: unknown) {
      console.error('Error proxying request:', _error);
      const errorResponse: ProxyResponse = {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'application/json' },
        body: { 
          error: 'Failed to reach destination host',
          errorSource: 'proxy',
          message: 'The proxy could not establish a connection to the target API',
          targetUrl: url,
          details: _error instanceof Error ? _error.message : 'Network error or timeout',
          possibleCauses: [
            'Target server is down or unreachable',
            'Network connectivity issues',
            'Request timeout (30 seconds)',
            'DNS resolution failure',
            'SSL/TLS certificate issues'
          ]
        },
        cookies: []
      };
      return json(errorResponse, { status: 502 });
    }

    // Extract data from the response
    // Note: Responses with status 4xx or 5xx from the destination host are NOT errors from our proxy.
    // They are legitimate responses from the target API and will have errorSource: 'destination' if needed.
    // Our proxy errors (above) always have errorSource: 'proxy' in the body.
    const responseData: ProxyResponse = {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: Object.fromEntries([...proxyResponse.headers.entries()]),
      body: null,
      cookies: [] // Will be populated with cookies from Set-Cookie headers
    };

    // Try to parse response as JSON or fall back to text
    try {
      if (proxyResponse.headers.get('content-type')?.includes('application/json')) {
        responseData.body = await proxyResponse.json();
      } else {
        responseData.body = await proxyResponse.text();
      }
    } catch (_error: unknown) {
      responseData.body = null;
    }

    // Extract cookies from the response but don't store them on server
    // Get all Set-Cookie headers (in Node.js/fetch API, we need to iterate through headers)
    const setCookieHeaders: string[] = [];
    proxyResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        // Some implementations might combine multiple cookies in one header
        setCookieHeaders.push(value);
      }
    });

    if (setCookieHeaders.length > 0) {
      for (const cookieHeader of setCookieHeaders) {
        // Handle multiple cookies in a single header (split by commas that aren't inside double quotes)
        const individualCookies = parseCookieHeader(cookieHeader);

        for (const individualCookie of individualCookies) {
          // Parse the cookie into a structured object
          const cookie = parseCookie(individualCookie, targetUrl.hostname);

          if (cookie) {
            responseData.cookies.push(cookie);
          }
        }
      }
    }

    // Helper function to parse potentially complex Set-Cookie headers
    function parseCookieHeader(header: string): string[] {
      const cookies: string[] = [];
      let currentCookie = '';
      let insideQuotes = false;

      // Split by commas, but respect quotes
      for (let i = 0; i < header.length; i++) {
        const char = header[i];

        if (char === '"') {
          insideQuotes = !insideQuotes;
          currentCookie += char;
        } else if (char === ',' && !insideQuotes) {
          // End of a cookie
          if (currentCookie.trim()) {
            cookies.push(currentCookie.trim());
          }
          currentCookie = '';
        } else {
          currentCookie += char;
        }
      }

      // Add the last cookie if there is one
      if (currentCookie.trim()) {
        cookies.push(currentCookie.trim());
      }

      return cookies.length > 0 ? cookies : [header];
    }

    // Helper function to parse a Set-Cookie header into a structured Cookie object
    function parseCookie(cookieStr: string, defaultDomain: string): Cookie | null {
      try {
        // Split the cookie string by semicolons
        const parts = cookieStr.split(';').map((part) => part.trim());

        // The first part is always name=value
        const mainPart = parts[0];
        const equalIndex = mainPart.indexOf('=');

        if (equalIndex <= 0) {
          return null; // Invalid cookie format
        }

        const name = mainPart.substring(0, equalIndex).trim();
        const value = mainPart.substring(equalIndex + 1).trim();

        const cookie: Cookie = { name, value };

        // Parse additional attributes
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].toLowerCase();

          if (part.startsWith('domain=')) {
            cookie.domain = part.substring('domain='.length);
          } else if (part.startsWith('path=')) {
            cookie.path = part.substring('path='.length);
          } else if (part.startsWith('expires=')) {
            cookie.expires = part.substring('expires='.length);
          } else if (part.startsWith('max-age=')) {
            cookie.maxAge = parseInt(part.substring('max-age='.length), 10);
          } else if (part === 'secure') {
            cookie.secure = true;
          } else if (part === 'httponly') {
            cookie.httpOnly = true;
          } else if (part.startsWith('samesite=')) {
            const sameSite = part.substring('samesite='.length).toLowerCase();
            if (sameSite === 'strict' || sameSite === 'lax' || sameSite === 'none') {
              cookie.sameSite = sameSite as 'strict' | 'lax' | 'none';
            }
          }
        }

        // If no domain is specified, use the hostname
        if (!cookie.domain) {
          cookie.domain = defaultDomain;
        }

        return cookie;
      } catch (_error: unknown) {
        console.error('Error parsing cookie:', _error, cookieStr);
        return null;
      }
    }

    return json(responseData);
  } catch (_error: unknown) {
    console.error('Proxy error:', _error);
    const errorResponse: ProxyResponse = {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
      body: { 
        error: 'Internal proxy error',
        errorSource: 'proxy',
        message: 'An unexpected error occurred in the proxy service',
        details: _error instanceof Error ? _error.message : 'Unknown error',
        suggestion: 'Please try again. If the problem persists, contact support'
      },
      cookies: []
    };
    return json(errorResponse, { status: 500 });
  }
};
