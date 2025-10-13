<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getApiList } from '$lib/http_client/apis';
  import { projectStore } from '$lib/store/project';
  import { onMount } from 'svelte';

  export let apiHosts: Record<string | number, { url: string; name?: string; description?: string }> = {};
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher();

  // Modal state
  let showAddApiModal = false;
  let availableApis: any[] = [];
  let loadingApis = false;
  let error: string | null = null;

  onMount(async () => {
    await loadAvailableApis();
  });

  async function loadAvailableApis() {
    try {
      loadingApis = true;
      const selectedProject = $projectStore.selectedProject;
      
      if (!selectedProject) {
        console.warn('No project selected, cannot load APIs');
        availableApis = [];
        return;
      }

      const apisData = await getApiList(selectedProject.id);
      if (apisData && apisData.apis && Array.isArray(apisData.apis)) {
        availableApis = apisData.apis;
      }
    } catch (err) {
      console.error('Error loading available APIs:', err);
      error = 'Failed to load available APIs';
    } finally {
      loadingApis = false;
    }
  }

  function addApiFromList(api: any) {
    const apiId = String(api.id);
    
    // Check if this API is already added
    if (apiHosts[apiId]) {
      error = 'This API is already added to the flow';
      return;
    }
    
    // Add the API host
    const updatedHosts = {
      ...apiHosts,
      [apiId]: {
        name: api.name || `API ${api.id}`,
        url: api.host || ''
      }
    };
    
    dispatch('change', { apiHosts: updatedHosts });
    showAddApiModal = false;
    error = null;
  }

  function addCustomApiHost() {
    const newApiId = `api-${Date.now()}`;
    const updatedHosts = {
      ...apiHosts,
      [newApiId]: {
        name: `API ${Object.keys(apiHosts).length + 1}`,
        url: ''
      }
    };
    
    dispatch('change', { apiHosts: updatedHosts });
    showAddApiModal = false;
  }

  function updateApiHost(apiId: string, field: 'name' | 'url', value: string) {
    const updatedHosts = {
      ...apiHosts,
      [apiId]: {
        ...apiHosts[apiId],
        [field]: value
      }
    };
    
    dispatch('change', { apiHosts: updatedHosts });
  }

  function removeApiHost(apiId: string) {
    const updatedHosts = { ...apiHosts };
    delete updatedHosts[apiId];
    
    dispatch('change', { apiHosts: updatedHosts });
  }

  function clearError() {
    error = null;
  }
</script>

<div>
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-medium text-gray-800">API Hosts</h3>
    <button
      class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={() => (showAddApiModal = true)}
      {disabled}
    >
      <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      Add API Host
    </button>
  </div>
  
  <p class="mb-4 text-sm text-gray-600">
    Configure the hosts for each API used in this test flow. Each endpoint in your flow will use its corresponding API host.
  </p>

  {#if error}
    <div class="relative mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
      <span class="block sm:inline">{error}</span>
      <button class="absolute top-0 right-0 bottom-0 px-4" on:click={clearError}>×</button>
    </div>
  {/if}
  
  <!-- API Hosts List -->
  {#if apiHosts && Object.keys(apiHosts).length > 0}
    <div class="rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host URL</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each Object.entries(apiHosts) as [apiId, apiInfo], index}
            <tr class={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center space-x-2">
                  <input
                    type="text"
                    value={apiInfo.name}
                    on:input={(e) => updateApiHost(apiId, 'name', e.currentTarget.value)}
                    {disabled}
                    class="rounded border border-gray-300 px-3 py-1.5 text-sm flex-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="API Name"
                  />
                  <span class="text-xs text-gray-500 whitespace-nowrap">ID: {apiId}</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <input
                  type="text"
                  value={apiInfo.url}
                  on:input={(e) => updateApiHost(apiId, 'url', e.currentTarget.value)}
                  {disabled}
                  class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="https://api.example.com"
                />
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right">
                <button
                  class="inline-flex items-center justify-center p-1.5 rounded-full text-red-600 hover:text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={() => removeApiHost(apiId)}
                  aria-label="Delete API host"
                  title="Delete this API host"
                  {disabled}
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <svg class="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
      </svg>
      <p class="mb-4 text-gray-600">No API hosts configured yet</p>
      <button
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => (showAddApiModal = true)}
        {disabled}
      >
        <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Add Your First API Host
      </button>
    </div>
  {/if}
</div>

<!-- Modal for adding API host -->
{#if showAddApiModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border border-gray-200">
      <h2 class="mb-4 text-xl font-bold">Add API Host</h2>

      {#if loadingApis}
        <div class="flex items-center justify-center py-8">
          <div class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
        </div>
      {:else if availableApis.length > 0}
        <div class="mb-6">
          <h3 class="mb-3 text-lg font-medium">Choose from Available APIs</h3>
          <div class="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {#each availableApis as api}
              {@const isAlreadyAdded = !!(apiHosts && apiHosts[String(api.id)])}
              <div class="border-b border-gray-100 last:border-b-0">
                <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900">{api.name || `API ${api.id}`}</h4>
                    <p class="text-sm text-gray-500 mt-1">{api.host || 'No host configured'}</p>
                    <p class="text-xs text-gray-400 mt-1">ID: {api.id}</p>
                  </div>
                  <button
                    class="ml-4 rounded-md px-3 py-1.5 text-sm transition
                           {isAlreadyAdded 
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                             : 'bg-blue-600 text-white hover:bg-blue-700'}"
                    disabled={isAlreadyAdded}
                    on:click={() => addApiFromList(api)}
                  >
                    {isAlreadyAdded ? 'Already Added' : 'Add'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="border-t pt-4">
          <h3 class="mb-3 text-lg font-medium">Or Create Custom API Host</h3>
          <button
            class="w-full rounded-md bg-gray-100 border-2 border-dashed border-gray-300 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition"
            on:click={addCustomApiHost}
          >
            <svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Custom API Host
          </button>
        </div>
      {:else}
        <div class="mb-6 text-center">
          <p class="text-gray-600 mb-4">No APIs found in your workspace.</p>
          <button
            class="w-full rounded-md bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 transition"
            on:click={addCustomApiHost}
          >
            <svg class="mx-auto h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Custom API Host
          </button>
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
          on:click={() => {
            showAddApiModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
