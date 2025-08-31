<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getApiList } from '$lib/http_client/apis';
  import type { SubEnvironment } from '$lib/types/environment';
  import type { Api } from '$lib/types/api';

  export let subEnvironments: Record<string, SubEnvironment> = {};
  export let linkedApis: number[] = [];
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { subEnvironments: Record<string, SubEnvironment> };
    updateLinkedApis: { linkedApis: number[] };
  }>();

  let availableApis: Api[] = [];
  let loading = true;
  let error: string | null = null;
  let showApiSelector = false;

  async function loadApis() {
    try {
      loading = true;
      error = null;
      const response = await getApiList();
      if (response && response.apis) {
        availableApis = response.apis;
      } else {
        availableApis = [];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load APIs';
      console.error('Error loading APIs:', err);
    } finally {
      loading = false;
    }
  }

  function updateSubEnvironments() {
    dispatch('change', { subEnvironments });
  }

  function addApiToLinked(apiId: number) {
    if (!linkedApis.includes(apiId)) {
      const newLinkedApis = [...linkedApis, apiId];
      dispatch('updateLinkedApis', { linkedApis: newLinkedApis });
    }
    showApiSelector = false;
  }

  function removeApiFromLinked(apiId: number) {
    const newLinkedApis = linkedApis.filter(id => id !== apiId);
    
    // Also remove from all sub-environments' api_hosts
    Object.keys(subEnvironments).forEach(subEnvKey => {
      if (subEnvironments[subEnvKey].api_hosts) {
        delete subEnvironments[subEnvKey].api_hosts[apiId.toString()];
      }
    });
    
    subEnvironments = { ...subEnvironments };
    dispatch('updateLinkedApis', { linkedApis: newLinkedApis });
    updateSubEnvironments();
  }

  function setApiHost(subEnvKey: string, apiId: string, hostUrl: string) {
    if (!subEnvironments[subEnvKey]) return;
    
    // Ensure api_hosts object exists
    if (!subEnvironments[subEnvKey].api_hosts) {
      subEnvironments[subEnvKey].api_hosts = {};
    }
    
    if (hostUrl.trim()) {
      subEnvironments[subEnvKey].api_hosts[apiId] = hostUrl.trim();
    } else {
      delete subEnvironments[subEnvKey].api_hosts[apiId];
    }
    
    subEnvironments = { ...subEnvironments };
    updateSubEnvironments();
  }

  function clearApiHost(subEnvKey: string, apiId: string) {
    if (!subEnvironments[subEnvKey]) return;
    
    delete subEnvironments[subEnvKey].api_hosts[apiId];
    subEnvironments = { ...subEnvironments };
    updateSubEnvironments();
  }

  function setDefaultApiHosts(subEnvKey: string) {
    if (!subEnvironments[subEnvKey]) return;
    
    const suggestions = getHostSuggestions(subEnvKey);
    
    linkedApisList.forEach(api => {
      if (api.id) {
        // Only set if not already configured
        if (!subEnvironments[subEnvKey].api_hosts[api.id.toString()]) {
          const baseDomain = suggestions[subEnvKey];
          subEnvironments[subEnvKey].api_hosts[api.id.toString()] = `https://${baseDomain}`;
        }
      }
    });
    
    subEnvironments = { ...subEnvironments };
    updateSubEnvironments();
  }

  function getHostSuggestions(subEnvKey: string): Record<string, string> {
    const basePatterns: Record<string, string> = {
      dev: 'api.dev.example.com',
      staging: 'api.staging.example.com',
      sit: 'api.sit.example.com',
      uat: 'api.uat.example.com',
      test: 'api.test.example.com',
      prod: 'api.example.com',
      production: 'api.example.com'
    };
    
    return {
      [subEnvKey]: basePatterns[subEnvKey] || `api.${subEnvKey}.example.com`
    };
  }

  onMount(() => {
    loadApis();
  });

  $: subEnvEntries = Object.entries(subEnvironments);
  $: linkedApisList = availableApis.filter(api => api.id && linkedApis.includes(api.id));
  $: unlinkedApisList = availableApis.filter(api => api.id && !linkedApis.includes(api.id));
</script>

<div class="border border-gray-200 rounded-lg bg-white" class:opacity-60={disabled} class:pointer-events-none={disabled}>
  <div class="flex justify-between items-center p-6 border-b border-gray-100">
    <h3 class="text-lg font-semibold text-gray-900 m-0">API Host Configuration</h3>
    <div class="flex items-center gap-4">
      {#if linkedApisList.length > 0}
        <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded text-sm font-medium">{linkedApisList.length} Linked APIs</span>
      {/if}
      {#if unlinkedApisList.length > 0}
        <button 
          class="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-300 px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={() => showApiSelector = true}
          {disabled}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Add API
        </button>
      {/if}
    </div>
  </div>

  <div class="p-4 bg-gray-50 border-b border-gray-100 text-sm text-gray-600">
    Configure specific API host URLs for each sub-environment. This allows the same test flows 
    to run against different API endpoints based on the selected environment.
  </div>

  {#if loading}
    <div class="p-8 text-center text-gray-600">
      <p>Loading APIs...</p>
    </div>
  {:else if error}
    <div class="p-8 text-center text-red-600">
      <p>Error: {error}</p>
      <button class="mt-4 bg-red-600 text-white border-0 px-4 py-2 rounded cursor-pointer hover:bg-red-700" on:click={loadApis}>Retry</button>
    </div>
  {:else if linkedApisList.length === 0}
    <div class="p-8 text-center text-gray-600">
      <p>No APIs linked to this environment.</p>
      {#if unlinkedApisList.length > 0}
        <button 
          class="mt-4 bg-green-600 text-white border-0 px-4 py-2 rounded cursor-pointer hover:bg-green-700"
          on:click={() => showApiSelector = true}
          {disabled}
          type="button"
        >
          Link APIs to Environment
        </button>
      {:else}
        <p class="text-sm text-gray-500 mt-2">Create APIs first before configuring environment hosts.</p>
      {/if}
    </div>
  {:else if subEnvEntries.length === 0}
    <div class="p-8 text-center text-gray-600">
      <p>No sub-environments configured. Add sub-environments first.</p>
    </div>
  {:else}
    <div class="p-6">
      {#each subEnvEntries as [subEnvKey, subEnv]}
        <div class="mb-8 border border-gray-200 rounded-lg bg-gray-50 last:mb-0">
          <div class="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
            <h4 class="flex items-center gap-2 m-0 text-base font-semibold">
              <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">{subEnvKey}</span>
              <span class="text-gray-600 font-normal">({subEnv.name})</span>
            </h4>
            <button 
              class="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-300 px-3 py-2 rounded text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-blue-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => setDefaultApiHosts(subEnvKey)}
              {disabled}
              type="button"
              title="Auto-fill with suggested host patterns"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
              Auto-fill
            </button>
          </div>

          <div class="p-4 flex flex-col gap-4">
            {#each linkedApisList as api}
              {@const apiId = api.id?.toString() || ''}
              {@const currentHost = subEnv.api_hosts[apiId] || ''}
              {@const suggestion = getHostSuggestions(subEnvKey)[subEnvKey]}
              
              <div class="grid grid-cols-[200px_1fr_auto] gap-4 items-start p-4 bg-white border border-gray-200 rounded-md">
                <div class="flex flex-col gap-1">
                  <div class="font-semibold text-gray-900 text-sm">{api.name}</div>
                  {#if api.description}
                    <div class="text-gray-600 text-xs">{api.description}</div>
                  {/if}
                  <div class="text-gray-400 text-xs font-mono">API ID: {apiId}</div>
                </div>
                
                <div class="flex gap-2 items-center">
                  <input
                    type="url"
                    value={currentHost}
                    on:input={(e) => {
                      const target = e.target as HTMLInputElement;
                      setApiHost(subEnvKey, apiId, target.value);
                    }}
                    placeholder={`e.g., https://${suggestion}`}
                    {disabled}
                    class="flex-1 px-2 py-2 border border-gray-300 rounded text-sm font-mono transition-colors focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
                  />
                  {#if currentHost}
                    <button 
                      class="p-2 bg-red-50 text-red-600 border-0 rounded cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      on:click={() => clearApiHost(subEnvKey, apiId)}
                      {disabled}
                      type="button"
                      aria-label="Clear host for {api.name}"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  {/if}
                </div>

                <button 
                  class="p-2 bg-red-50 text-red-600 border-0 rounded cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={() => removeApiFromLinked(api.id!)}
                  {disabled}
                  type="button"
                  title="Remove API from environment"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Configuration Summary -->
    <div class="border-t border-gray-200 p-6 bg-gray-50">
      <h4 class="m-0 mb-4 text-base font-semibold text-gray-700">Configuration Summary</h4>
      <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        {#each subEnvEntries as [subEnvKey, subEnv]}
          <div class="bg-white border border-gray-200 rounded-md p-4">
            <div class="flex justify-between items-center mb-3">
              <span class="font-semibold text-gray-900">{subEnvKey}</span>
              <span class="text-xs text-gray-600">
                {Object.keys(subEnv.api_hosts).length} of {linkedApisList.length} APIs configured
              </span>
            </div>
            {#if Object.keys(subEnv.api_hosts).length > 0}
              <div class="flex flex-col gap-2">
                {#each Object.entries(subEnv.api_hosts) as [apiId, hostUrl]}
                  {@const api = linkedApisList.find(a => a.id?.toString() === apiId)}
                  <div class="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-b-0">
                    <span class="font-medium text-gray-700">{api?.name || `API ${apiId}`}:</span>
                    <span class="font-mono text-gray-600 text-xs">{hostUrl}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-sm text-gray-400 italic">No API hosts configured - will use default endpoints</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- API Selector Modal -->
{#if showApiSelector}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" on:click={() => showApiSelector = false}>
    <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" on:click|stopPropagation>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-900 m-0">Add APIs to Environment</h3>
        <button 
          class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          on:click={() => showApiSelector = false}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      {#if unlinkedApisList.length === 0}
        <div class="text-center py-8 text-gray-600">
          <p>All available APIs are already linked to this environment.</p>
        </div>
      {:else}
        <div class="flex flex-col gap-3">
          {#each unlinkedApisList as api}
            <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div class="flex flex-col gap-1">
                <div class="font-semibold text-gray-900">{api.name}</div>
                {#if api.description}
                  <div class="text-gray-600 text-sm">{api.description}</div>
                {/if}
                <div class="text-gray-400 text-xs font-mono">API ID: {api.id}</div>
              </div>
              <button 
                class="bg-green-600 text-white border-0 px-4 py-2 rounded cursor-pointer hover:bg-green-700 transition-colors"
                on:click={() => addApiToLinked(api.id!)}
                type="button"
              >
                Add
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}


