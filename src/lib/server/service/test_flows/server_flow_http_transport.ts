import { isIP } from 'node:net';
import type { FlowHttpRequest, FlowHttpTransport, RequestCookie } from '$lib/flow-runner';

const PRIVATE_RUNS_FLAG = 'TEST_PILOT_ALLOW_PRIVATE_SERVER_RUNS';

export class ServerFlowHttpTransport implements FlowHttpTransport {
  async execute(request: FlowHttpRequest): Promise<Response> {
    assertServerRunUrlAllowed(request.url);

    const targetUrl = new URL(request.url);
    const headers = new Headers(request.headers);
    const cookieHeader = buildCookieHeaderFromStore(request.cookieStore, targetUrl.hostname);
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeout);

    try {
      const response = await fetch(request.url, {
        method: request.endpointDef.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        redirect: 'follow',
        signal: controller.signal
      });

      const responseCookies = extractCookiesFromResponse(response, targetUrl.hostname);
      if (responseCookies.length > 0) {
        request.cookieStore.set(request.endpointId, responseCookies);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const serverFlowHttpTransport = new ServerFlowHttpTransport();

export function assertServerRunUrlAllowed(url: string): void {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol for server-side run: ${parsed.protocol}`);
  }

  if (process.env[PRIVATE_RUNS_FLAG] === 'true') {
    return;
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error(
      `Server-side runs cannot target private or localhost host "${parsed.hostname}" unless ${PRIVATE_RUNS_FLAG}=true`
    );
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [a, b] = normalized.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

function buildCookieHeaderFromStore(
  cookieStore: Map<string, RequestCookie[]>,
  requestDomain: string
): string | undefined {
  const matchedCookies = Array.from(cookieStore.values())
    .flat()
    .filter((cookie) => {
      return (
        cookie.domain === requestDomain ||
        requestDomain.endsWith(`.${cookie.domain}`) ||
        cookie.domain === 'localhost'
      );
    });

  if (matchedCookies.length === 0) {
    return undefined;
  }

  return matchedCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function extractCookiesFromResponse(response: Response, defaultDomain: string): RequestCookie[] {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  const rawSetCookieHeaders =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : response.headers.has('set-cookie')
        ? [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value))
        : [];

  return rawSetCookieHeaders.flatMap((header) =>
    splitSetCookieHeader(header)
      .map((cookie) => parseCookie(cookie, defaultDomain))
      .filter((cookie): cookie is RequestCookie => Boolean(cookie))
  );
}

function splitSetCookieHeader(header: string): string[] {
  return header.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim());
}

function parseCookie(cookieHeader: string, defaultDomain: string): RequestCookie | null {
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const nameValue = parts[0];
  const equalsIndex = nameValue.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const cookie: RequestCookie = {
    name: nameValue.slice(0, equalsIndex),
    value: nameValue.slice(equalsIndex + 1),
    domain: defaultDomain
  };

  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (lower.startsWith('domain=')) {
      cookie.domain = part.slice('domain='.length).replace(/^\./, '');
    } else if (lower.startsWith('path=')) {
      cookie.path = part.slice('path='.length);
    }
  }

  return cookie.value ? cookie : null;
}
