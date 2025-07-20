
import type { Endpoint, StepEndpoint } from '$lib/types/test-flow';
import { fetchWithAuth } from './util';

export interface RequestCookie {
	name: string;
	value: string;
	domain: string;
	path?: string;
}

export async function getTestFlows() {
	try {
		const response = await fetchWithAuth('/api/test-flows');
		if (response.ok) {
			const data = await response.json();
			return data.testFlows || [];
		} else {
			console.error('Failed to fetch test flows:', response.statusText);
			return [];
		}
	} catch (error) {
		console.error('Error fetching test flows:', error);
		return [];
	}
}

export async function getTestFlow(testFlowId: string) {
	try {
		const response = await fetchWithAuth(`/api/test-flows/${testFlowId}`);
		if (response.ok) {
			return await response.json();
		} else {
			console.error(`Failed to fetch test flow ${testFlowId}:`, response.statusText);
			return null;
		}
	} catch (error) {
		console.error(`Error fetching test flow ${testFlowId}:`, error);
		return null;
	}
}

export async function updateTestFlow(testFlowId: string, data: any) {
	try {
		const response = await fetchWithAuth(`/api/test-flows/${testFlowId}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
		
		if (response.ok) {
			return await response.json();
		} else {
			console.error(`Failed to update test flow ${testFlowId}:`, response.statusText);
			return null;
		}
	} catch (error) {
		console.error(`Error updating test flow ${testFlowId}:`, error);
		return null;
	}
}

export async function createTestFlow(data: any) {
	try {
		const response = await fetchWithAuth('/api/test-flows', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		
		if (response.ok) {
			return await response.json();
		} else {
			console.error('Failed to create test flow:', response.statusText);
			return null;
		}
	} catch (error) {
		console.error('Error creating test flow:', error);
		return null;
	}
}

export async function deleteTestFlow(id: string | number) {
	try {
		const response = await fetchWithAuth('/api/test-flows', {
			method: 'DELETE',
			body: JSON.stringify({ id })
		});
		
		if (response.ok) {
			return await response.json();
		} else {
			console.error(`Failed to delete test flow ${id}:`, response.statusText);
			return null;
		}
	} catch (error) {
		console.error(`Error deleting test flow ${id}:`, error);
		return null;
	}
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

	const proxyResponse = await fetchWithAuth(proxyUrl, {
		method: 'POST',
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
