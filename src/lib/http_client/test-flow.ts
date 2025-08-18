
import type { Endpoint, StepEndpoint } from '$lib/types/test-flow';
import { fetchWithAuth } from './util';

export interface RequestCookie {
	name: string;
	value: string;
	domain: string;
	path?: string;
}

export async function getTestFlows(options: {
	page?: number;
	limit?: number;
	search?: string;
} = {}) {
	try {
		const { page = 1, limit = 20, search } = options;
		const url = new URL('/api/test-flows', window.location.origin);
		
		url.searchParams.set('page', page.toString());
		url.searchParams.set('limit', limit.toString());
		if (search) {
			url.searchParams.set('search', search);
		}

		const response = await fetchWithAuth(url.toString());
		if (response.ok) {
			return await response.json();
		} else {
			console.error('Failed to fetch test flows:', response.statusText);
			return { testFlows: [], pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
		}
	} catch (error) {
		console.error('Error fetching test flows:', error);
		return { testFlows: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
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

export async function generateTestFlow(data: {
  endpointIds: number[];
  description: string;
}) {
  try {
    const response = await fetchWithAuth('/api/test-flows/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate test flow');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error generating test flow:', error);
    throw error;
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

/**
 * Execute a direct HTTP request to an endpoint, handling cookies and timeouts
 */
export async function executeDirectEndpoint(
    endpointDef: Endpoint,
    url: string,
    headers: Record<string, string>,
    body: any,
    timeout: number,
    cookieStore?: Map<string, Array<RequestCookie>>,
    endpointId?: string
): Promise<Response> {
    const debugMode = true; // Set to false to disable verbose logging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const requestDomain = new URL(url).hostname;
    
    try {
        // Process cookie headers if needed
        let mergedHeaders = { ...headers };
        if (cookieStore && cookieStore.size > 0) {
            const cookieHeader = buildCookieHeaderFromStore(cookieStore, requestDomain);
            if (cookieHeader) {
                debugMode && console.log(`Adding Cookie header: ${cookieHeader}`);
                mergedHeaders = { ...mergedHeaders, 'Cookie': cookieHeader };
            }
        }
        
        // Choose between Tauri HTTP client and browser fetch
        let response: Response;
        
        if (isDesktop && typeof window !== 'undefined' && (window as any).__TAURI__) {
            response = await executeTauriRequest(
                endpointDef.method,
                url,
                mergedHeaders,
                body,
                cookieStore,
                endpointId
            );
        } else {
            // Browser mode with standard fetch
            response = await fetch(url, {
                method: endpointDef.method,
                headers: mergedHeaders,
                body: body ? JSON.stringify(body) : null,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'include'
            });
        }
        
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Execute a request using Tauri's HTTP client
 */
async function executeTauriRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    cookieStore?: Map<string, Array<RequestCookie>>,
    endpointId?: string
): Promise<Response> {
    const debugMode = true; // Set to false to disable verbose logging
    const requestDomain = new URL(url).hostname;
    
    try {
        // Dynamic import to avoid issues in browser environments
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        
        // Log request details if in debug mode
        if (debugMode) {
            console.log(`[Tauri HTTP Request] ${method} ${url}`);
            console.log('[Tauri HTTP Request Headers]', headers);
            if (body) console.log('[Tauri HTTP Request Body]', body);
        }
        
        // Execute the request
        const response = await tauriFetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            credentials: 'include'
        });
        
        // Log response details if in debug mode
        if (debugMode) {
            console.log(`[Tauri HTTP Response] ${method} ${url} ${response.status}`);
            console.log('[Tauri HTTP Response Status]', response.status, response.statusText);
            console.log('[Tauri HTTP Response Headers]:');
            response.headers.forEach((value, key) => console.log(`${key}: ${value}`));
        }
        
        // Process cookies if cookie store is provided
        if (cookieStore) {
            processTauriResponseCookies(response, cookieStore, requestDomain, endpointId);
        }
        
        return response;
    } catch (error) {
        console.error('Error using Tauri HTTP client:', error);
        // Fall back to browser fetch
        return fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            mode: 'cors',
            credentials: 'include'
        });
    }
}

/**
 * Process and store cookies from a Tauri response
 */
function processTauriResponseCookies(
    response: Response, 
    cookieStore: Map<string, Array<RequestCookie>>, 
    domain: string,
    endpointId?: string
): void {
    const debugMode = true; // Set to false to disable verbose logging
    
    const extractedCookies = extractCookiesFromTauriResponse(response, domain);
    if (extractedCookies.length === 0) return;
    
    // Use endpoint ID as storage key if provided, otherwise use the domain
    const storageKey = endpointId || `domain:${domain}`;
    
    // Get existing cookies and merge with new ones
    const existingCookies = cookieStore.get(storageKey) || [];
    const mergedCookies = [...existingCookies];
    
    for (const newCookie of extractedCookies) {
        // Find existing cookie with same name, domain, and path
        const existingIndex = mergedCookies.findIndex(c => 
            c.name === newCookie.name && 
            c.domain === newCookie.domain && 
            (c.path === newCookie.path || (!c.path && !newCookie.path))
        );
        
        // Replace or add the cookie
        if (existingIndex !== -1) {
            mergedCookies[existingIndex] = newCookie;
        } else {
            mergedCookies.push(newCookie);
        }
    }
    
    // Update the cookie store
    cookieStore.set(storageKey, mergedCookies);
    
    if (debugMode) {
        console.log(
            `Stored ${extractedCookies.length} cookies for ${endpointId ? `endpoint ${endpointId}` : `domain ${domain}`}`
        );
        console.log(`Cookie store now contains ${mergedCookies.length} cookies for this key`);
    }
}

/**
 * Parse cookie string into name and value
 * @param cookieStr Cookie string in name=value format
 * @returns Object with name and value properties, or null if invalid
 */
function parseCookieNameValue(cookieStr: string): { name: string, value: string } | null {
    const nameValueSplit = cookieStr.indexOf('=');
    if (nameValueSplit === -1) return null;
    
    const name = cookieStr.slice(0, nameValueSplit).trim();
    let value = cookieStr.slice(nameValueSplit + 1).trim();
    
    // Handle quoted values
    if (value.startsWith('"') && value.endsWith('"')) {
        value = decodeURIComponent(value.slice(1, -1));
    } else {
        value = decodeURIComponent(value);
    }
    
    return name ? { name, value } : null;
}

/**
 * Parse Set-Cookie headers from a Tauri response and convert them to RequestCookie objects
 * @param response The response from Tauri HTTP client
 * @param domain The domain to associate with the cookie
 * @returns Array of RequestCookie objects
 */
function extractCookiesFromTauriResponse(response: Response, domain: string): RequestCookie[] {
    const cookies: RequestCookie[] = [];
    const debugMode = true; // Set to false to disable verbose logging
    
    debugMode && console.log(`Extracting cookies for domain: ${domain}`);

    // Process Set-Cookie headers
    if (response.headers.has('set-cookie')) {
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
            debugMode && console.log(`Raw Set-Cookie header: ${setCookieHeader}`);
            
            // Split by comma followed by space and a word with an equals sign
            const rawCookies = setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
            debugMode && console.log(`Parsed ${rawCookies.length} cookies from header`);
            
            for (const rawCookie of rawCookies) {
                const parts = rawCookie.split(';');
                const cookieNameValue = parseCookieNameValue(parts[0].trim());
                if (!cookieNameValue) continue;
                
                // Create cookie with defaults
                const cookie: RequestCookie = {
                    name: cookieNameValue.name,
                    value: cookieNameValue.value,
                    domain: domain
                };
                
                // Process attributes
                for (const part of parts.slice(1)) {
                    const partTrimmed = part.trim().toLowerCase();
                    if (partTrimmed.startsWith('domain=')) {
                        let cookieDomain = part.split('=')[1].trim();
                        // Remove leading dot
                        if (cookieDomain.startsWith('.')) cookieDomain = cookieDomain.slice(1);
                        cookie.domain = cookieDomain;
                    } else if (partTrimmed.startsWith('path=')) {
                        cookie.path = part.split('=')[1].trim();
                    }
                }
                
                debugMode && console.log(`Extracted cookie: ${cookie.name}=${cookie.value}, domain=${cookie.domain}, path=${cookie.path || '/'}`);
                cookies.push(cookie);
            }
        }
    }
    
    // Process non-standard cookie headers
    const nonStandardHeaders = Array.from(response.headers.keys())
        .filter(key => key.toLowerCase().includes('cookie') && key.toLowerCase() !== 'set-cookie');
    
    for (const key of nonStandardHeaders) {
        const value = response.headers.get(key);
        if (!value) continue;
        
        debugMode && console.log(`Found non-standard cookie header: ${key}=${value}`);
        
        try {
            for (const part of value.split(';')) {
                const cookieNameValue = parseCookieNameValue(part);
                if (cookieNameValue) {
                    const cookie = {
                        name: cookieNameValue.name,
                        value: cookieNameValue.value,
                        domain: domain
                    };
                    debugMode && console.log(`Extracted non-standard cookie: ${cookie.name}=${cookie.value}`);
                    cookies.push(cookie);
                }
            }
        } catch (e) {
            console.error('Error parsing non-standard cookie header:', e);
        }
    }
    
    // Filter out empty cookies
    const validCookies = cookies.filter(cookie => cookie.value !== '');
    
    if (debugMode && validCookies.length !== cookies.length) {
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
    const debugMode = true; // Set to false to disable verbose logging
    
    // Get all cookies and filter by domain if needed
    const matchedCookies = Array.from(cookieStore.values())
        .flat()
        .filter(cookie => {
            if (!requestDomain) return true;
            
            return (
                cookie.domain === requestDomain || // Exact domain match
                requestDomain.endsWith(`.${cookie.domain}`) || // Parent domain match
                cookie.domain === 'localhost' // Always include localhost cookies
            );
        });
    
    if (matchedCookies.length === 0) {
        return undefined;
    }
    
    debugMode && console.log(`Found ${matchedCookies.length} matching cookies for domain: ${requestDomain || 'any'}`);
    
    // Build the cookie header string
    return matchedCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Execute a request through a proxy endpoint
 */
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

    try {
        // Send the request through the proxy
        const proxyResponse = await fetchWithAuth(proxyUrl, {
            method: 'POST',
            body: JSON.stringify({
                url,
                method: endpointDef.method,
                headers,
                body: body ? JSON.stringify(body) : null,
                cookies
            }),
            signal: controller.signal
        });

        // Parse the proxy response
        const proxyData = await proxyResponse.json();

        // Reconstruct a Response object from the proxy data
        const response = new Response(
            proxyData.body ? JSON.stringify(proxyData.body) : null, 
            {
                status: proxyData.status,
                statusText: proxyData.statusText,
                headers: new Headers(proxyData.headers)
            }
        );

        return { 
            response, 
            cookies: proxyData.cookies || [] 
        };
    } finally {
        clearTimeout(timeoutId);
    }
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
