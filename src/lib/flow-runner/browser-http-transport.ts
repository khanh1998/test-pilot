import { isDesktop } from '$lib/environment';
import { executeDirectEndpoint, executeProxiedEndpoint } from '$lib/http_client/test-flow';
import type { FlowHttpRequest, FlowHttpTransport, RequestCookie } from './http-transport';

export class BrowserFlowHttpTransport implements FlowHttpTransport {
  async execute(request: FlowHttpRequest): Promise<Response> {
    if (request.useServerCookieHandling) {
      return this.makeProxiedRequest(request);
    }

    return this.makeDirectRequest(request);
  }

  private async makeProxiedRequest(request: FlowHttpRequest): Promise<Response> {
    const targetUrl = new URL(request.url);
    const requestCookies = Array.from(request.cookieStore.values())
      .flat()
      .filter((cookie) => cookie.value.length > 0);

    request.addLog(
      'debug',
      `Sending ${requestCookies.length} cookies with request`,
      `Target domain: ${targetUrl.hostname}`
    );

    const proxiedResult = await executeProxiedEndpoint(
      request.endpointDef,
      request.url,
      request.headers,
      request.body,
      requestCookies,
      request.timeout
    );

    if (proxiedResult.cookies.length > 0) {
      request.cookieStore.set(
        request.endpointId,
        proxiedResult.cookies.map((cookie: RequestCookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || targetUrl.hostname,
          path: cookie.path
        }))
      );
    }

    request.addLog(
      'info',
      'Request proxied through server for cookie handling',
      `Original URL: ${request.url}\nProxy URL: /api/proxy/request`
    );

    return proxiedResult.response;
  }

  private async makeDirectRequest(request: FlowHttpRequest): Promise<Response> {
    const response = await executeDirectEndpoint(
      request.endpointDef,
      request.url,
      request.headers,
      request.body,
      request.timeout,
      request.cookieStore,
      request.endpointId
    );

    if (isDesktop) {
      request.addLog(
        'debug',
        'Desktop mode: cookies managed via Tauri HTTP client',
        `Cookies for ${request.endpointId}: ${
          request.cookieStore.has(request.endpointId)
            ? request.cookieStore.get(request.endpointId)?.length
            : 0
        } cookies`
      );
    }

    return response;
  }
}

export const browserFlowHttpTransport = new BrowserFlowHttpTransport();
