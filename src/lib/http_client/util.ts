import { authStore } from '$lib/store/auth';

/**
 * Utility function to make authenticated API requests
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
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

  // Make the request with auth headers
  const response = await fetch(url, {
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
