import { authStore } from '$lib/store/auth';
import { apiUrl } from '$lib/api-config';
import { isDesktop } from '$lib/environment';

/**
 * Type definition for Tauri's fetch options to handle type compatibility
 */
type TauriFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  credentials?: RequestCredentials;
  redirect?: RequestRedirect;
  cache?: RequestCache;
};

/**
 * Type definition for Tauri's HTTP module to help with TypeScript
 */
type TauriHttp = {
  fetch: (url: string, options?: TauriFetchOptions) => Promise<Response>;
};

// Tauri HTTP client reference - will be initialized if in desktop mode
let tauriHttp: TauriHttp | null = null;

// Initialize Tauri HTTP client if we're in desktop mode
if (isDesktop && typeof window !== 'undefined') {
  // Dynamic import for Tauri HTTP client
  const loadTauriHttp = async () => {
    try {
      const module = await import('@tauri-apps/plugin-http');
      tauriHttp = module;
      console.log('[HTTP Client] Initialized Tauri HTTP client');
    } catch (error) {
      console.error('[HTTP Client] Failed to load Tauri HTTP client:', error);
    }
  };
  
  // Initialize when this module is loaded
  loadTauriHttp();
}

/**
 * Utility function to make authenticated API requests
 * Uses Tauri HTTP client in desktop mode to bypass CORS and cookie policies
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Convert relative API URLs to absolute URLs based on environment
  const fullUrl = url.startsWith('http') ? url : apiUrl(url);
  // Get auth headers
  const headers = authStore.getAuthHeaders();

  // Get existing headers or initialize empty object
  const existingHeaders = options.headers as Record<string, string> || {};
  
  // Check if we're sending FormData (in which case we shouldn't set Content-Type)
  const isFormData = options.body instanceof FormData;
  
  // Merge headers with proper Content-Type
  const mergedHeaders = {
    // Only set default Content-Type if not FormData
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...existingHeaders,
    ...headers
  };

  // Use Tauri HTTP client for desktop app to bypass CORS and cookie policies
  if (isDesktop && tauriHttp) {
    try {
      console.log('[HTTP Client] Using Tauri HTTP client for request:', fullUrl);
      
      // Convert body to appropriate format for Tauri HTTP client
      let processedBody = options.body;
      if (typeof options.body === 'object' && !isFormData && !(options.body instanceof Blob)) {
        processedBody = JSON.stringify(options.body);
      }

      // Convert merged headers to a definite Record<string, string> for Tauri
      const tauriHeaders: Record<string, string> = {};
      
      // Add each header to our new object, ensuring all values are strings
      Object.entries(mergedHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          tauriHeaders[key] = String(value);
        }
      });
      
      // Make the request with Tauri HTTP client
      const response = await tauriHttp.fetch(fullUrl, {
        method: options.method || 'GET',
        headers: tauriHeaders,
        body: processedBody,
        // Copy other fetch options as needed
        credentials: options.credentials,
        redirect: options.redirect,
        cache: options.cache,
      });

      // Handle unauthorized errors (token expired or invalid)
      if (response.status === 401) {
        // Sign out user if token is invalid
        authStore.signOut();
        throw new Error('Your session has expired. Please sign in again.');
      }

      return response;
    } catch (error) {
      console.error('[HTTP Client] Error using Tauri HTTP client:', error);
      // Fall back to regular fetch if Tauri HTTP fails
      console.warn('[HTTP Client] Falling back to regular fetch');
    }
  }

  // Use regular fetch for web or as fallback
  const response = await fetch(fullUrl, {
    ...options,
    headers: mergedHeaders as HeadersInit
  });

  // Handle unauthorized errors (token expired or invalid)
  if (response.status === 401) {
    // Sign out user if token is invalid
    authStore.signOut();
    throw new Error('Your session has expired. Please sign in again.');
  }

  return response;
}
