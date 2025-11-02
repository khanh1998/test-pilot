<script lang="ts">
  import type { Environment } from '$lib/types/environment';
  import EnvironmentEditor from '$lib/components/environments/EnvironmentEditor.svelte';
  import { getEnvironment, updateEnvironment } from '$lib/http_client/environments';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';
  
  let environment: Environment | null = $state(null);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error: string | null = $state(null);

  const envId = parseInt($page.params.envId || '0');

  onMount(async () => {
    if (!envId) {
      error = 'Invalid environment ID';
      isLoading = false;
      return;
    }

    try {
      environment = await getEnvironment(envId);
      if (!environment) {
        error = 'Environment not found';
      } else {
        // Set breadcrumb overrides for environment ID and edit
        setBreadcrumbOverride(envId.toString(), environment.name);
        setBreadcrumbOverride('edit', 'Edit');
      }
    } catch (err) {
      console.error('Error loading environment:', err);
      error = err instanceof Error ? err.message : 'Failed to load environment';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    // Clean up breadcrumb overrides when component is destroyed
    clearBreadcrumbOverride(envId.toString());
    clearBreadcrumbOverride('edit');
  });

  async function handleSave(event: CustomEvent<{ environmentData: any }>) {
    if (!environment) return;
    
    try {
      isSubmitting = true;
      error = null;
      
      const { environmentData } = event.detail;
      await updateEnvironment(environment.id, environmentData);
      
      // Navigate back to environment detail page
      goto(`/projects/environment/${environment.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update environment';
      console.error('Error updating environment:', err);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    if (!environment) {
      goto('/projects/environment');
      return;
    }
    // Navigate back to environment detail page
    goto(`/projects/environment/${environment.id}`);
  }
</script>

<svelte:head>
  <title>{environment ? `Edit ${environment.name}` : 'Edit Environment'} | Test-Pilot</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 p-8">
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-600">Loading environment...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Error Loading Environment</h1>
      <p class="text-gray-600 mb-6">{error}</p>
      <a href="/projects/environment" class="text-blue-600 hover:underline font-medium">← Back to Environments</a>
    </div>
  {:else if !environment}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Environment Not Found</h1>
      <p class="text-gray-600 mb-6">The requested environment could not be found.</p>
      <a href="/projects/environment" class="text-blue-600 hover:underline font-medium">← Back to Environments</a>
    </div>
  {:else}
    {#if error}
      <div class="max-w-4xl mx-auto mb-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div class="flex items-center gap-2 text-red-700 text-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>{error}</span>
          </div>
          <button class="text-red-700 hover:bg-red-100 p-1 rounded transition-colors" onclick={() => error = null} aria-label="Close error message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <div class="max-w-4xl mx-auto">
      <EnvironmentEditor 
        {environment}
        isEditing={true}
        disabled={isSubmitting}
        on:save={handleSave}
        on:cancel={handleCancel}
      />
    </div>
  {/if}
</div>
