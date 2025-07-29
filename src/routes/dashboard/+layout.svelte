<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/store/auth';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
  let isLoading = $state(true);
  let isAuthenticated = $state(false);

  onMount(async () => {
    try {
      const authResult = await authStore.checkAuth();
      isAuthenticated = authResult;
      
      if (!isAuthenticated) {
        goto('/');
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      goto('/');
      return;
    } finally {
      isLoading = false;
    }
  });
</script>

{#if isLoading}
  <div class="flex h-screen items-center justify-center bg-gray-100">
    <div class="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else}
  <DashboardLayout>
    {@render children()}
  </DashboardLayout>
{/if}
