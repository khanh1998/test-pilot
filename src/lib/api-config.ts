import { isDesktop } from './environment';

// Base URL for API calls
// In production web app: Uses relative URLs (same origin)
// In desktop app: Points to your deployed backend
const PRODUCTION_API_URL = 'https://test-pilot-five.vercel.app'; // Replace with your actual deployed API URL
const DEV_API_URL = 'http://localhost:5173'; // Development server

// Determine the correct API URL based on environment
export const API_BASE_URL = (() => {
  // For desktop app in production, use remote API
  if (isDesktop && import.meta.env.PROD) {
    return PRODUCTION_API_URL;
  }
  
  // For development, use local dev server
  if (import.meta.env.DEV) {
    return DEV_API_URL;
  }
  
  // For web app in production, use relative URLs
  return '';
})();

// Helper function to build API URLs
export function apiUrl(path: string): string {
  // Ensure path starts with /api/
  const apiPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return `${API_BASE_URL}${apiPath}`;
}
