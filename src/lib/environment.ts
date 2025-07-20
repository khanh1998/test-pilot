// This file helps determine if we're in a desktop or web environment
// Access via import { isDesktop } from '$lib/environment';

// In SvelteKit, use import.meta.env instead of process.env
const APP_ENV = import.meta.env.VITE_APP_ENV;

// Log environment info for debugging
if (typeof console !== 'undefined') {
  console.log('[Environment] VITE_APP_ENV:', APP_ENV);
  console.log('[Environment] Window Tauri:', typeof window !== 'undefined' && 
    // @ts-ignore
    (window.__TAURI__ !== undefined));
}

// Check for Tauri-specific window objects at runtime
export const isDesktop = typeof window !== 'undefined' && (
  // @ts-ignore - __TAURI__ is injected by Tauri
  window.__TAURI__ !== undefined || 
  // Check for environment variable set during build  
  APP_ENV === 'desktop'
);

// Export build-time settings (passed to layout files)
export const layoutSettings = {
  // In desktop mode: disable SSR, use client-side rendering
  // In web mode: enable SSR for better SEO and performance
  ssr: !isDesktop,
  // Auto prerender for web static pages, but not for desktop
  prerender: isDesktop ? false : 'auto' as const
};
