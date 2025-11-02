<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getEnvironments, deleteEnvironment } from '$lib/http_client/environments';
  import EnvironmentCreator from './EnvironmentCreator.svelte';
  import EnvironmentCard from './EnvironmentCard.svelte';
  import type { Environment } from '$lib/types/environment';

  let environments: Environment[] = [];
  let loading = true;
  let error: string | null = null;
  let showCreator = false;
  let isDeleting = false;

  async function loadEnvironments() {
    try {
      loading = true;
      environments = await getEnvironments();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load environments';
      console.error('Error loading environments:', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadEnvironments();
  });

  function handleCreateEnvironment() {
    showCreator = true;
  }

  function handleEnvironmentCreated() {
    showCreator = false;
    loadEnvironments(); // Refresh the list
  }

  function handleCreatorClose() {
    showCreator = false;
  }

  function handleEnvironmentView(event: CustomEvent<{ environment: Environment }>) {
    const { environment } = event.detail;
    goto(`/projects/environment/${environment.id}`);
  }

  function handleEnvironmentEdit(event: CustomEvent<{ environment: Environment }>) {
    const { environment } = event.detail;
    goto(`/projects/environment/${environment.id}/edit`);
  }

  async function handleEnvironmentDelete(event: CustomEvent<{ environment: Environment }>) {
    const { environment } = event.detail;
    
    try {
      isDeleting = true;
      error = null;
      
      const success = await deleteEnvironment(environment.id);
      
      if (success) {
        // Remove the environment from the local list
        environments = environments.filter(env => env.id !== environment.id);
      } else {
        error = 'Failed to delete environment';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete environment';
      console.error('Error deleting environment:', err);
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="p-4">
  <div class="flex justify-between items-center mb-8">
    <h2 class="text-2xl font-semibold text-gray-900 m-0">Environments</h2>
    <button class="inline-flex items-center gap-2 bg-blue-600 text-white border-0 px-4 py-3 rounded-md font-medium cursor-pointer transition-colors text-sm hover:bg-blue-700" onclick={handleCreateEnvironment}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Create Environment
    </button>
  </div>
  
  {#if loading}
    <div class="text-center p-8">Loading environments...</div>
  {:else if error}
    <div class="text-center p-8 text-red-600">
      <p>Error: {error}</p>
      <button class="mt-4 bg-red-600 text-white border-0 px-4 py-2 rounded cursor-pointer hover:bg-red-700" onclick={loadEnvironments}>Try Again</button>
    </div>
  {:else if environments.length === 0}
    <div class="text-center py-16 px-8">
      <div class="mx-auto mb-4 text-gray-400">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="9"></circle>
          <circle cx="12" cy="10" r="3"></circle>
          <path d="M16.5 15.5c-1.5 1.5-3.5 2.5-4.5 2.5s-3-1-4.5-2.5"></path>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 mb-4">No environments found</h3>
      <p class="text-gray-600 mb-8 max-w-md mx-auto">Create your first environment to manage different deployment configurations like dev, staging, and production.</p>
      <button class="inline-flex items-center gap-2 bg-blue-600 text-white border-0 px-4 py-3 rounded-md font-medium cursor-pointer transition-colors text-sm hover:bg-blue-700" onclick={handleCreateEnvironment}>
        Create Your First Environment
      </button>
    </div>
  {:else}
    <div class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
      {#each environments as environment}
        <EnvironmentCard 
          {environment} 
          on:view={handleEnvironmentView}
          on:edit={handleEnvironmentEdit}
          on:delete={handleEnvironmentDelete}
        />
      {/each}
    </div>
  {/if}
</div>

{#if showCreator}
  <EnvironmentCreator 
    on:created={handleEnvironmentCreated} 
    on:close={handleCreatorClose} 
  />
{/if}


