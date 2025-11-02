<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/store/auth';
  import { page } from '$app/stores';

  let { children } = $props();
  let isLoading = $state(true);

  // Check if current route is a projects route (which includes the project management page)
  let isProjectsRoute = $derived($page.url.pathname.startsWith('/projects'));

  onMount(() => {
    // Check initial session
    authStore.checkAuth().then(() => {
      isLoading = false;
    });
  });
</script>

<div class="min-h-screen bg-gray-50">
  {#if isLoading}
    <div class="flex h-screen items-center justify-center">
      <div
        class="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"
      ></div>
    </div>
    {:else if isProjectsRoute}
    <!-- Projects routes handle their own layout (full-width for management, sidebar for features) -->
    {@render children()}
  {:else}
    <!-- Non-projects routes get the container padding -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {@render children()}
    </div>
  {/if}
</div>
