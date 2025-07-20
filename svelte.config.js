import staticAdapter from '@sveltejs/adapter-static'; 
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Determine which adapter to use based on environment variable
// For Node.js build process, we use process.env.VITE_APP_ENV
const isDesktopBuild = process.env.VITE_APP_ENV === 'desktop';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    // Use different adapter based on build target
    adapter: isDesktopBuild 
      ? staticAdapter({
          // Desktop build uses SPA mode with static adapter
          fallback: 'index.html',
          pages: 'build',
          assets: 'build',
          precompress: false
        })
      : vercelAdapter(), // Web build uses Vercel adapter
    
    // Disable prerendering checks for dynamic routes
    prerender: {
      handleMissingId: 'ignore'
    }
  }
};

export default config;
