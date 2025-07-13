
import type { Endpoint, StepEndpoint } from '$lib/types/test-flow';

export interface RequestCookie {
	name: string;
	value: string;
	domain: string;
	path?: string;
}

export async function executeDirectEndpoint(
	endpointDef: Endpoint,
	url: string,
	headers: Record<string, string>,
	body: any,
	timeout: number
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	const response = await fetch(url, {
		method: endpointDef.method,
		headers,
		body: body ? JSON.stringify(body) : null,
		signal: controller.signal,
		mode: 'cors',
		credentials: 'include'
	});

	clearTimeout(timeoutId);
	return response;
}

export async function executeProxiedEndpoint(
	endpointDef: Endpoint,
	url: string,
	headers: Record<string, string>,
	body: any,
	cookies: RequestCookie[],
	timeout: number
): Promise<{ response: Response; cookies: RequestCookie[] }> {
	const proxyUrl = '/api/proxy/request';
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	const proxyResponse = await fetch(proxyUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${localStorage.getItem('authToken')}`
		},
		body: JSON.stringify({
			url,
			method: endpointDef.method,
			headers,
			body: body ? JSON.stringify(body) : null,
			cookies: cookies
		}),
		signal: controller.signal
	});

	clearTimeout(timeoutId);

	const proxyData = await proxyResponse.json();

	const response = new Response(proxyData.body ? JSON.stringify(proxyData.body) : null, {
		status: proxyData.status,
		statusText: proxyData.statusText,
		headers: new Headers(proxyData.headers)
	});

	return { response, cookies: proxyData.cookies || [] };
}
