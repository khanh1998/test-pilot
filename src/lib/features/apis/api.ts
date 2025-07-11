import { authStore } from '../auth/stores/auth';

/**
 * Utility function to make authenticated API requests
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Get auth headers
  const headers = authStore.getAuthHeaders();

  // Merge with existing headers
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
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
