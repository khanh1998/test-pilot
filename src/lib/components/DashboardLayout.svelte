<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/store/auth';
  import { projectStore } from '$lib/store/project';
  import ProjectSelector from './ProjectSelector.svelte';
  import type { User } from '$lib/store/auth';
  import type { Snippet } from 'svelte';

  // Props
  interface Props {
    children: Snippet;
    breadcrumbOverrides?: { segment: string; name: string }[];
  }
  let { children, breadcrumbOverrides = [] }: Props = $props();

  // State
  let sidebarOpen = $state(true);
  let user: User | null = $state(null);
  let error: string | null = $state(null);

  // Subscribe to the auth store
  const unsubscribe = authStore.subscribe((state) => {
    user = state.user;
  });

  // Unsubscribe when component is destroyed
  onDestroy(() => {
    unsubscribe();
  });

  // Handle sign out
  async function handleSignOut() {
    try {
      await authStore.signOut();
      // Clear project store on logout
      projectStore.clear();
      goto('/');
    } catch (err: any) {
      error = err?.message || 'An error occurred during sign out';
    }
  }

  // Toggle sidebar
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  // Navigation items
  const navigationItems = [
    {
      name: 'Modules',
      href: '/dashboard/modules',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    {
      name: 'APIs',
      href: '/dashboard/apis',
      icon: 'M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8'
    },
    {
      name: 'Environment',
      href: '/dashboard/environment',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    },
    {
      name: 'Test Flows',
      href: '/dashboard/test-flows',
      icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
    }
  ];

  // Check if current route is active
  function isActiveRoute(href: string): boolean {
    return $page.url.pathname === href;
  }

  // Generate breadcrumb items based on current path
  function generateBreadcrumbs() {
    const path = $page.url.pathname;
    const segments = path.split('/').filter(Boolean);
    
    const breadcrumbs = [];

    // Skip the dashboard segment (index 0) and start from meaningful segments
    if (segments.length > 1) {
      let currentPath = '';
      
      for (let i = 1; i < segments.length; i++) {
        currentPath += '/' + segments[i];
        const fullPath = '/dashboard' + currentPath;
        const isLast = i === segments.length - 1;
        
        // Map segment names to display names
        let displayName = segments[i];
        let href = fullPath;
        
        // Check for override first
        const override = breadcrumbOverrides.find(o => o.segment === segments[i]);
        if (override) {
          displayName = override.name;
        } else {
          switch (segments[i]) {
            case 'apis':
              displayName = 'APIs';
              break;
            case 'modules':
              displayName = 'Modules';
              break;
            case 'environment':
              displayName = 'Environment';
              break;
            case 'test-flows':
              displayName = 'Test Flows';
              break;
            case 'generate':
              displayName = 'Generate Flow';
              break;
            case 'upload':
              displayName = 'Upload API';
              break;
            default:
              // For dynamic segments (like IDs), try to get a more meaningful name
              if (/^\d+$/.test(segments[i])) {
                // This is an ID segment - determine what kind based on parent
                const parentSegment = i > 1 ? segments[i - 1] : '';
                if (parentSegment === 'apis') {
                  displayName = 'API Details';
                  href = isLast ? fullPath : fullPath;
                } else if (parentSegment === 'projects') {
                  displayName = 'Project Details';
                  href = isLast ? fullPath : fullPath;
                } else if (parentSegment === 'modules') {
                  displayName = 'Module Details';
                  href = isLast ? fullPath : fullPath;
                } else if (parentSegment === 'test-flows') {
                  displayName = 'Test Flow Details';
                  href = isLast ? fullPath : fullPath;
                } else {
                  displayName = `#${segments[i]}`;
                }
              } else {
                // Capitalize first letter for other segments
                displayName = segments[i].charAt(0).toUpperCase() + segments[i].slice(1);
              }
          }
        }
        
        breadcrumbs.push({
          name: displayName,
          href: href,
          isLast
        });
      }
    }
    
    // If we're on the main dashboard page or no breadcrumbs were generated, return empty array
    // This will hide the breadcrumb bar on the main dashboard
    return breadcrumbs;
  }

  let breadcrumbs = $derived(generateBreadcrumbs());
</script>

<div class="flex h-screen bg-gray-100">
  <!-- Sidebar -->
  <div class="relative flex flex-col {sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 transition-all duration-300 ease-in-out">
    <!-- Sidebar header -->
    <div class="flex h-16 flex-shrink-0 items-center justify-between bg-gray-900 px-4">
      {#if sidebarOpen}
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-white">Test Pilot</h1>
        </div>
      {/if}
      <button
        type="button"
        onclick={toggleSidebar}
        class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Toggle sidebar"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {#if sidebarOpen}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          {/if}
        </svg>
      </button>
    </div>

    <!-- Project Selector -->
    <div class="px-4 py-2">
      <ProjectSelector isCollapsed={!sidebarOpen} />
    </div>

    <!-- Navigation -->
    <nav class="mt-4 flex-1 space-y-1 px-2">
      {#each navigationItems as item}
        <a
          href={item.href}
          class="group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors duration-200 {isActiveRoute(item.href)
            ? 'bg-gray-800 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'}"
        >
          <svg
            class="mr-3 h-5 w-5 flex-shrink-0 {isActiveRoute(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
          </svg>
          {#if sidebarOpen}
            {item.name}
          {/if}
        </a>
      {/each}
    </nav>

    <!-- User section -->
    <div class="flex flex-shrink-0 border-t border-gray-700 p-4">
      <div class="group block w-full flex-shrink-0">
        {#if sidebarOpen}
          <div class="flex items-center">
            <div class="ml-3">
              <p class="text-sm font-medium text-white">
                {user?.email || 'User'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onclick={handleSignOut}
            class="mt-2 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Sign out
          </button>
        {:else}
          <button
            type="button"
            onclick={handleSignOut}
            class="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Breadcrumb Navigation - Fixed at top (only show if there are breadcrumbs) -->
    {#if breadcrumbs.length > 0}
      <div class="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <nav class="flex" aria-label="Breadcrumb">
          <ol class="flex items-center space-x-2">
            {#each breadcrumbs as crumb, index}
              <li class="flex items-center">
                {#if index > 0}
                  <svg class="mr-2 h-4 w-4 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                  </svg>
                {/if}
                {#if crumb.isLast}
                  <span class="text-sm font-medium text-gray-900">{crumb.name}</span>
                {:else}
                  <a 
                    href={crumb.href} 
                    class="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
                  >
                    {crumb.name}
                  </a>
                {/if}
              </li>
            {/each}
          </ol>
        </nav>
      </div>
    {/if}



    <!-- Page content -->
    <main class="flex-1 overflow-y-auto bg-white">
      <div class="h-full">
        {@render children()}
      </div>
    </main>
  </div>
</div>

{#if error}
  <div class="fixed bottom-4 right-4 rounded-md bg-red-50 p-4 shadow-lg">
    <div class="flex">
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-800">Error</h3>
        <div class="mt-2 text-sm text-red-700">
          <p>{error}</p>
        </div>
      </div>
      <div class="ml-auto pl-3">
        <button
          type="button"
          onclick={() => (error = null)}
          class="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
          aria-label="Dismiss error"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}