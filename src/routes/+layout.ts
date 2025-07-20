import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { layoutSettings } from '$lib/environment';

// Apply the appropriate settings based on build target
export const prerender = layoutSettings.prerender;
export const ssr = layoutSettings.ssr;

export const load = async ({ url }: { url: URL }) => {
  if (!browser) {
    return { isAuthenticated: false, user: null };
  }

  // Check if token exists in localStorage
  const token = localStorage.getItem('authToken');
  const storedUser = localStorage.getItem('authUser');
  const user = storedUser ? JSON.parse(storedUser) : null;

  // Check if user is authenticated
  const isAuthenticated = !!token;

  // If on root page and authenticated, redirect to dashboard
  if (url.pathname === '/' && isAuthenticated) {
    throw redirect(302, '/dashboard');
  }

  // If on dashboard and not authenticated, redirect to sign in
  if (url.pathname.startsWith('/dashboard') && !isAuthenticated) {
    throw redirect(302, '/');
  }

  return {
    isAuthenticated,
    user
  };
};
