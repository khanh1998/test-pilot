<script lang="ts">
  import type { Environment } from '$lib/types/environment';
  import { getEnvironment } from '$lib/http_client/environments';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { setBreadcrumbOverride, clearBreadcrumbOverride } from '$lib/store/breadcrumb';
  
  let environment: Environment | null = null;
  let isLoading = true;
  let error: string | null = null;

  const envId = parseInt($page.params.envId || '0');

  $: subEnvironments = environment ? Object.entries(environment.config.environments) : [];
  $: variableDefinitions = environment ? Object.entries(environment.config.variable_definitions || {}) : [];

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
        // Set breadcrumb override for the environment ID
        setBreadcrumbOverride(envId.toString(), environment.name);
      }
    } catch (err) {
      console.error('Error loading environment:', err);
      error = err instanceof Error ? err.message : 'Failed to load environment';
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    // Clean up breadcrumb override when component is destroyed
    clearBreadcrumbOverride(envId.toString());
  });
</script>

<div class="max-w-6xl mx-auto p-8">
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-600">Loading environment...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Error Loading Environment</h1>
      <p class="text-gray-600 mb-6">{error}</p>
      <a href="/dashboard/environments" class="text-blue-600 hover:underline font-medium">← Back to Environments</a>
    </div>
  {:else if !environment}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <h1 class="text-2xl font-semibold text-gray-700 mb-2">Environment Not Found</h1>
      <p class="text-gray-600 mb-6">The requested environment could not be found.</p>
      <a href="/dashboard/environments" class="text-blue-600 hover:underline font-medium">← Back to Environments</a>
    </div>
  {:else}
    <div class="flex justify-between items-start mb-8 gap-8">
      <div class="flex-1">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">{environment.name}</h1>
        {#if environment.description}
          <p class="text-lg text-gray-600 mb-4">{environment.description}</p>
        {/if}
        
        <div class="flex gap-8 text-sm">
          <span class="text-gray-600">
            <strong>Type:</strong> {environment.config.type.replace('_', ' ')}
          </span>
          <span class="text-gray-600">
            <strong>Created:</strong> {new Date(environment.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <div class="flex gap-4">
        <a href="/dashboard/environments/{environment.id}/edit" class="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit Environment
        </a>
      </div>
    </div>

    <div class="flex flex-col gap-8">
      <!-- Sub-Environments Section -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Sub-Environments</h2>
        <div class="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {#each subEnvironments as [subEnvName, subEnvConfig]}
            <div class="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
              <h3 class="text-xl font-semibold text-gray-900 mb-2">{subEnvName}</h3>
              {#if subEnvConfig.name !== subEnvName}
                <p class="text-gray-600 mb-2">{subEnvConfig.name}</p>
              {/if}
              {#if subEnvConfig.description}
                <p class="text-sm text-gray-600 mb-4">{subEnvConfig.description}</p>
              {/if}
              
              <div class="grid gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 mb-2">Variables</h4>
                  {#if Object.keys(subEnvConfig.variables).length > 0}
                    <ul class="space-y-2">
                      {#each Object.entries(subEnvConfig.variables) as [varName, varValue]}
                        <li class="flex justify-between items-center py-2 border-b border-gray-100 text-sm last:border-b-0">
                          <span class="font-medium text-gray-700">{varName}:</span>
                          <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{varValue}</code>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="text-sm text-gray-500 italic">Using default values</p>
                  {/if}
                </div>
                
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 mb-2">API Hosts</h4>
                  {#if Object.keys(subEnvConfig.api_hosts).length > 0}
                    <ul class="space-y-2">
                      {#each Object.entries(subEnvConfig.api_hosts) as [apiId, hostUrl]}
                        <li class="flex justify-between items-center py-2 border-b border-gray-100 text-sm last:border-b-0">
                          <span class="font-medium text-gray-700">API {apiId}:</span>
                          <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{hostUrl}</code>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="text-sm text-gray-500 italic">No custom hosts configured</p>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Variable Definitions Section -->
      <section>
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Variable Definitions</h2>
        {#if variableDefinitions.length > 0}
          <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div class="grid grid-cols-5 bg-gray-50 border-b border-gray-200">
              <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Name</div>
              <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Type</div>
              <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Required</div>
              <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Default Value</div>
              <div class="px-3 py-3 font-semibold text-gray-700 text-sm">Description</div>
            </div>
            {#each variableDefinitions as [varName, varDef]}
              <div class="grid grid-cols-5 border-b border-gray-100 last:border-b-0">
                <div class="px-3 py-3 flex items-center">
                  <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-900">{varName}</code>
                </div>
                <div class="px-3 py-3 flex items-center">
                  <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium uppercase">{varDef.type}</span>
                </div>
                <div class="px-3 py-3 flex items-center">
                  <span class="px-2 py-1 rounded text-xs font-medium {varDef.required ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}">
                    {varDef.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <div class="px-3 py-3 flex items-center">
                  <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-800">{JSON.stringify(varDef.default_value)}</code>
                </div>
                <div class="px-3 py-3 flex items-center">
                  <span class="text-gray-600 text-sm">{varDef.description || '-'}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8 text-gray-600">
            <p>No variable definitions found.</p>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>
