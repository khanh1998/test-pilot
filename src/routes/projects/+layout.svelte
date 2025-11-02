<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/store/auth';
  import { projectStore } from '$lib/store/project';
  import { breadcrumbOverrides } from '$lib/store/breadcrumb';
  import DashboardLayout from '$lib/components/DashboardLayout.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }
  let { children }: Props = $props();
  let isLoading = $state(true);
  let isAuthenticated = $state(false);

  // Check if we're on the main projects page (project management) or a feature page
  let isProjectManagementPage = $derived($page.url.pathname === '/projects');

  onMount(async () => {
    try {
      const authResult = await authStore.checkAuth();
      isAuthenticated = authResult;
      
      if (!isAuthenticated) {
        goto('/');
        return;
      }

      // Load projects for all dashboard/project pages
      await projectStore.loadProjects();
      
    } catch (error) {
      console.error('Dashboard layout initialization failed:', error);
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
{:else if isProjectManagementPage}
  <!-- Full-width project management page without sidebar -->
  {@render children()}
{:else}
  <!-- Dashboard layout with sidebar for feature pages -->
  <DashboardLayout breadcrumbOverrides={$breadcrumbOverrides}>
    {@render children()}
  </DashboardLayout>
{/if}
