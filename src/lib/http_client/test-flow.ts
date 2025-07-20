
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

import { isDesktop } from '$lib/environment';

export async function executeDirectEndpoint(
	endpointDef: Endpoint,
	url: string,
	headers: Record<string, string>,
	body: any,
	timeout: number,
	cookieStore?: Map<string, Array<RequestCookie>>,
	endpointId?: string
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	// Include cookies from cookieStore in the request if provided
	let mergedHeaders = { ...headers };
	if (cookieStore && cookieStore.size > 0 && endpointId) {
		const cookieHeader = buildCookieHeaderFromStore(cookieStore);
		if (cookieHeader) {
			mergedHeaders = { ...mergedHeaders, 'Cookie': cookieHeader };
		}
	}

	let response: Response;

	if (isDesktop && typeof window !== 'undefined' && (window as any).__TAURI__) {
		// Desktop mode: Use Tauri HTTP client
		try {
			// Dynamic import to avoid issues in browser environments
			const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
			
			response = await tauriFetch(url, {
				method: endpointDef.method,
				headers: mergedHeaders,
				body: body ? JSON.stringify(body) : null,
				// Note: AbortController is handled differently in Tauri
				credentials: 'include'
			});

			// Log all headers to help identify if cookies are present
			console.log('Tauri Response Headers:');
			response.headers.forEach((value, key) => {
				console.log(`${key}: ${value}`);
			});
			
			// Extract and store cookies from the response if cookieStore and endpointId are provided
			if (cookieStore && endpointId) {
				const extractedCookies = extractCookiesFromTauriResponse(response, new URL(url).hostname);
				if (extractedCookies.length > 0) {
					cookieStore.set(endpointId, extractedCookies);
					console.log(`Stored ${extractedCookies.length} cookies for endpoint ${endpointId}`, extractedCookies);
				}
			}
		} catch (error) {
			console.error('Error using Tauri HTTP client:', error);
			// Fall back to browser fetch if Tauri fetch fails
			response = await fetch(url, {
				method: endpointDef.method,
				headers: mergedHeaders,
				body: body ? JSON.stringify(body) : null,
				signal: controller.signal,
				mode: 'cors',
				credentials: 'include'
			});
		}
	} else {
		// Browser mode: Use standard fetch (browser handles cookies automatically)
		response = await fetch(url, {
			method: endpointDef.method,
			headers: mergedHeaders,
			body: body ? JSON.stringify(body) : null,
			signal: controller.signal,
			mode: 'cors',
			credentials: 'include'
		});
	}

	clearTimeout(timeoutId);
	return response;
}

/**
 * Parse Set-Cookie headers from a Tauri response and convert them to RequestCookie objects
 * @param response The response from Tauri HTTP client
 * @param domain The domain to associate with the cookie
 * @returns Array of RequestCookie objects
 */
function extractCookiesFromTauriResponse(response: Response, domain: string): RequestCookie[] {
	const cookies: RequestCookie[] = [];

	// Check if the response has Set-Cookie headers
	if (response.headers.has('set-cookie')) {
		// Get all Set-Cookie headers (may be combined or separate)
		const setCookieHeader = response.headers.get('set-cookie');
		if (setCookieHeader) {
			// Split by comma and semicolon to handle potential multiple cookies
			// This is a simplified approach and might need refinement for complex cases
			const rawCookies = setCookieHeader.split(',');
			
			for (const rawCookie of rawCookies) {
				// Parse each cookie
				const parts = rawCookie.split(';');
				const mainPart = parts[0].trim();
				
				// Get name and value from the first part
				const [name, value] = mainPart.split('=').map(s => s.trim());
				
				// Create cookie object
				const cookie: RequestCookie = {
					name,
					value: decodeURIComponent(value),
					domain: domain,
				};
				
				// Check for path in the cookie parts
				for (const part of parts.slice(1)) {
					if (part.trim().toLowerCase().startsWith('path=')) {
						cookie.path = part.split('=')[1].trim();
						break;
					}
				}
				
				cookies.push(cookie);
			}
		}
	}
	
	// Look for non-standard headers that might contain cookies
	const headerKeys = Array.from(response.headers.keys());
	const cookieHeaders = headerKeys.filter(key => 
		key.toLowerCase().includes('cookie') && key.toLowerCase() !== 'set-cookie');
	
	for (const key of cookieHeaders) {
		const value = response.headers.get(key);
		if (value) {
			console.log(`Found non-standard cookie header: ${key}=${value}`);
			// Try to parse as cookie if possible
			try {
				const cookieParts = value.split('=');
				if (cookieParts.length >= 2) {
					cookies.push({
						name: cookieParts[0].trim(),
						value: cookieParts.slice(1).join('=').trim(),
						domain: domain
					});
				}
			} catch (e) {
				console.error('Error parsing non-standard cookie header:', e);
			}
		}
	}
	
	return cookies;
}

/**
 * Build a Cookie header value from the cookieStore
 * @param cookieStore The map of cookies by endpoint ID
 * @returns Cookie header string or undefined if no cookies
 */
function buildCookieHeaderFromStore(cookieStore: Map<string, Array<RequestCookie>>): string | undefined {
	// Collect all cookies from the store
	const allCookies: RequestCookie[] = [];
	
	for (const [_endpointId, cookies] of cookieStore.entries()) {
		allCookies.push(...cookies);
	}
	
	if (allCookies.length === 0) {
		return undefined;
	}
	
	// Build the cookie header string
	return allCookies.map(cookie => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join('; ');
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

/**
 * Update a test flow with new data
 * @param testFlowId The ID of the test flow to update
 * @param data The updated data (name, description, flowJson)
 * @returns The updated test flow data or null on error
 */
export async function saveTestFlow(testFlowId: number, data: any) {
	try {
		const response = await fetchWithAuth(`/api/test-flows/${testFlowId}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || `Failed to update test flow: ${response.statusText}`);
		}

		return await response.json();
	} catch (err) {
		console.error('Error updating test flow:', err);
		throw err;
	}
}
