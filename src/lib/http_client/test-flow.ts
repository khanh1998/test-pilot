
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
	if (cookieStore && cookieStore.size > 0) {
		// Get the domain from the URL for domain-specific cookie filtering
		const requestDomain = new URL(url).hostname;
		console.log(`Building cookies for request to domain: ${requestDomain}`);
		
		const cookieHeader = buildCookieHeaderFromStore(cookieStore, requestDomain);
		if (cookieHeader) {
			console.log(`Adding Cookie header: ${cookieHeader}`);
			mergedHeaders = { ...mergedHeaders, 'Cookie': cookieHeader };
		} else {
			console.log(`No matching cookies found for domain: ${requestDomain}`);
		}
	}

	let response: Response;

	if (isDesktop && typeof window !== 'undefined' && (window as any).__TAURI__) {
		// Desktop mode: Use Tauri HTTP client
		try {
			// Dynamic import to avoid issues in browser environments
			const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
			
			// Log the request details
			console.log(`[Tauri HTTP Request] ${endpointDef.method} ${url}`);
			console.log('[Tauri HTTP Request Headers]', mergedHeaders);
			if (body) {
				console.log('[Tauri HTTP Request Body]', body);
			}
			
			// For Tauri HTTP client with unsafe-headers enabled
			response = await tauriFetch(url, {
				method: endpointDef.method,
				headers: mergedHeaders,
				body: body ? JSON.stringify(body) : null,
				// Note: AbortController is handled differently in Tauri
				credentials: 'include'
			});

			// Log response details
			console.log(`[Tauri HTTP Response] ${endpointDef.method} ${url} ${response.status}`);
			console.log('[Tauri HTTP Response Status]', response.status, response.statusText);
			
			// Log all headers
			console.log('[Tauri HTTP Response Headers]:');
			response.headers.forEach((value, key) => {
				console.log(`${key}: ${value}`);
			});
			
			// Extract and store cookies from the response if cookieStore is provided
			if (cookieStore) {
				const requestDomain = new URL(url).hostname;
				const extractedCookies = extractCookiesFromTauriResponse(response, requestDomain);
				
				if (extractedCookies.length > 0) {
					// Use endpoint ID as storage key if provided, otherwise use the domain
					const storageKey = endpointId || `domain:${requestDomain}`;
					
					// Get existing cookies for this key
					const existingCookies = cookieStore.get(storageKey) || [];
					
					// Merge cookies, replacing existing ones with the same name
					const mergedCookies = [...existingCookies];
					
					for (const newCookie of extractedCookies) {
						// Replace existing cookie with the same name if it exists
						const existingIndex = mergedCookies.findIndex(c => 
							c.name === newCookie.name && 
							c.domain === newCookie.domain && 
							(c.path === newCookie.path || (!c.path && !newCookie.path))
						);
						
						if (existingIndex !== -1) {
							mergedCookies[existingIndex] = newCookie;
						} else {
							mergedCookies.push(newCookie);
						}
					}
					
					cookieStore.set(storageKey, mergedCookies);
					console.log(`Stored ${extractedCookies.length} cookies for ${endpointId ? `endpoint ${endpointId}` : `domain ${requestDomain}`}`);
					console.log(`Cookie store now contains ${mergedCookies.length} cookies for this key`);
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
	
	console.log(`Extracting cookies for domain: ${domain}`);

	// Check if the response has Set-Cookie headers
	if (response.headers.has('set-cookie')) {
		// Get all Set-Cookie headers (may be combined or separate)
		const setCookieHeader = response.headers.get('set-cookie');
		if (setCookieHeader) {
			console.log(`Raw Set-Cookie header: ${setCookieHeader}`);
			
			// Split by comma followed by space and a word with an equals sign
			// This better handles multiple Set-Cookie headers that might be concatenated
			const rawCookies = setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
			console.log(`Parsed ${rawCookies.length} cookies from header`);
			
			for (const rawCookie of rawCookies) {
				// Parse each cookie
				const parts = rawCookie.split(';');
				const mainPart = parts[0].trim();
				
				// Get name and value from the first part
				const nameValueSplit = mainPart.indexOf('=');
				if (nameValueSplit === -1) continue; // Invalid cookie format
				
				const name = mainPart.slice(0, nameValueSplit).trim();
				const value = mainPart.slice(nameValueSplit + 1).trim();
				
				if (!name) continue; // Skip invalid cookies
				
				// Extract cookie attributes
				let cookieDomain = domain; // Default to request domain
				let cookiePath: string | undefined = undefined;
				
				for (const part of parts.slice(1)) {
					const partTrimmed = part.trim().toLowerCase();
					if (partTrimmed.startsWith('domain=')) {
						// Use the domain specified in the cookie if present
						cookieDomain = part.split('=')[1].trim();
						// Remove leading dot if present (implicit subdomain matching)
						if (cookieDomain.startsWith('.')) {
							cookieDomain = cookieDomain.slice(1);
						}
					} else if (partTrimmed.startsWith('path=')) {
						cookiePath = part.split('=')[1].trim();
					}
				}
				
				// Create cookie object
				const cookie: RequestCookie = {
					name,
					value: value.startsWith('"') && value.endsWith('"') 
						? decodeURIComponent(value.slice(1, -1)) 
						: decodeURIComponent(value),
					domain: cookieDomain
				};
				
				if (cookiePath) {
					cookie.path = cookiePath;
				}
				
				console.log(`Extracted cookie: ${cookie.name}=${cookie.value}, domain=${cookie.domain}, path=${cookie.path || '/'}`);
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
				const cookieParts = value.split(';');
				for (const part of cookieParts) {
					const nameValueSplit = part.indexOf('=');
					if (nameValueSplit !== -1) {
						const name = part.slice(0, nameValueSplit).trim();
						const value = part.slice(nameValueSplit + 1).trim();
						if (name) {
							const cookie = {
								name,
								value,
								domain: domain
							};
							console.log(`Extracted non-standard cookie: ${cookie.name}=${cookie.value}, domain=${cookie.domain}`);
							cookies.push(cookie);
						}
					}
				}
			} catch (e) {
				console.error('Error parsing non-standard cookie header:', e);
			}
		}
	}
	
	// Filter out empty/expired cookies (Max-Age=0 or empty value)
	const validCookies = cookies.filter(cookie => cookie.value !== '');
	
	if (validCookies.length !== cookies.length) {
		console.log(`Filtered out ${cookies.length - validCookies.length} expired or empty cookies`);
	}
	
	return validCookies;
}

/**
 * Build a Cookie header value from the cookieStore
 * @param cookieStore The map of cookies by endpoint ID
 * @param requestDomain Optional domain to filter cookies by
 * @returns Cookie header string or undefined if no cookies
 */
function buildCookieHeaderFromStore(
	cookieStore: Map<string, Array<RequestCookie>>, 
	requestDomain?: string
): string | undefined {
	// Collect all cookies from the store that match the domain if specified
	const matchedCookies: RequestCookie[] = [];
	
	for (const [_endpointId, cookies] of cookieStore.entries()) {
		if (requestDomain) {
			// Filter cookies that match the request domain
			const domainCookies = cookies.filter(cookie => {
				// Direct domain match
				if (cookie.domain === requestDomain) {
					return true;
				}
				
				// Check if cookie domain is a parent domain of the request domain
				// For example, cookie for .example.com should match sub.example.com
				if (requestDomain.endsWith(`.${cookie.domain}`)) {
					return true;
				}
				
				// Cookie domains without a dot prefix should match exactly
				return false;
			});
			
			// Also include cookies with domain 'localhost' as they might be relevant in development
			const localCookies = cookies.filter(cookie => cookie.domain === 'localhost');
			
			matchedCookies.push(...domainCookies, ...localCookies);
		} else {
			// If no domain specified, include all cookies
			matchedCookies.push(...cookies);
		}
	}
	
	if (matchedCookies.length === 0) {
		return undefined;
	}
	
	console.log(`Found ${matchedCookies.length} matching cookies for domain: ${requestDomain || 'any'}`);
	
	// Build the cookie header string
	return matchedCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
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
