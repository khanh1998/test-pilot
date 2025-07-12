<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/store/auth';

  let { children } = $props();
  let isLoading = $state(true);

  onMount(() => {
    // Check initial session
    authStore.checkAuth().then(() => {
      isLoading = false;
    });
  });
</script>

<div class="min-h-screen bg-gray-50">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    {#if isLoading}
      <div class="flex h-screen items-center justify-center">
        <div
          class="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"
        ></div>
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>
</div>
