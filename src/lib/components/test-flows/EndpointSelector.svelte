<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let endpoints: {
    id: number;
    apiId: number;
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
  }[] = [];
  export let disabled: boolean = false;
  export let apiHosts: Record<string | number, { url: string; name?: string; description?: string }> = {};
  export let showSelector: boolean = false; // Make this a component parameter with default false

  const dispatch = createEventDispatcher();
  let searchTerm = '';
  let selectedTags: string[] = [];
  let selectedMethod = '';
  let selectedApiId = '';

  $: allTags = [...new Set(endpoints.flatMap((e) => e.tags || []))].sort();
  
  // Get list of all API IDs used by endpoints
  $: apiIds = [...new Set(endpoints.map((e) => e.apiId))];
  
  // Create readable API names mapping
  $: apiNames = Object.fromEntries(
    apiIds.map(id => [
      id, 
      (apiHosts[id]?.name || `API ${id}`)
    ])
  );

  $: filteredEndpoints = endpoints.filter((endpoint) => {
    // Filter by search term
    const matchesSearch =
      searchTerm === '' ||
      endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.operationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.summary?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by selected tags
    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tag) => endpoint.tags?.includes(tag));

    // Filter by HTTP method
    const matchesMethod = selectedMethod === '' || endpoint.method === selectedMethod;
    
    // Filter by API ID - ensure consistent type comparison
    const matchesApi = selectedApiId === '' || 
                      String(endpoint.apiId) === String(selectedApiId);
    
    return matchesSearch && matchesTags && matchesMethod && matchesApi;
  });
  
  // Group endpoints by API ID for better organization
  $: groupedEndpoints = filteredEndpoints.reduce((groups, endpoint) => {
    const apiId = String(endpoint.apiId); // Convert to string for consistent keys
    if (!groups[apiId]) {
      groups[apiId] = [];
    }
    groups[apiId].push(endpoint);
    return groups;
  }, {} as Record<string, typeof filteredEndpoints>);

  function selectEndpoint(endpoint: (typeof endpoints)[number]) {
    dispatch('select', endpoint);
    // Keep selector open for continuous selection
    searchTerm = '';
  }

  function toggleTagFilter(tag: string) {
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter((t) => t !== tag);
    } else {
      selectedTags = [...selectedTags, tag];
    }
  }
</script>

<div>
  {#if !showSelector}
    <button
      class="flex w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      on:click={() => (showSelector = true)}
      {disabled}
    >
      <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        ></path>
      </svg>
      Add Endpoint
    </button>
  {:else}
    <div class="rounded-md border bg-white p-3">
      <div class="mb-3 flex items-center justify-between">
        <h4 class="font-medium">Browse Endpoints</h4>
      </div>

      <div class="mb-4">
        <input
          type="text"
          placeholder="Search endpoints..."
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          bind:value={searchTerm}
        />
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <select bind:value={selectedMethod} class="rounded border px-2 py-1 text-sm">
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        
        <!-- API selector -->
        {#if apiIds.length > 1}
          <select bind:value={selectedApiId} class="rounded border px-2 py-1 text-sm">
            <option value="">All APIs</option>
            {#each apiIds as apiId (apiId)}
              <option value={String(apiId)}>{apiNames[apiId] || `API ${apiId}`}</option>
            {/each}
          </select>
        {/if}

        {#if allTags.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each allTags as tag (tag)}
              <button
                class="rounded border px-2 py-1 text-xs {selectedTags.includes(tag)
                  ? 'border-blue-300 bg-blue-100 text-blue-800'
                  : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                on:click={() => toggleTagFilter(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="max-h-80 overflow-y-auto rounded-md border border-gray-200">
        {#if filteredEndpoints.length === 0}
          <div class="p-4 text-center text-gray-500">No endpoints found matching your filters</div>
        {:else}
          <div class="divide-y divide-gray-100">
            {#each Object.entries(groupedEndpoints) as [apiId, endpoints] (apiId)}
              <!-- API Group Header -->
              <div class="bg-gray-50 px-3 py-2">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-gray-700">
                    {apiNames[apiId] || apiHosts[apiId]?.name || `API ${apiId}`}
                  </span>
                  <span class="text-xs text-gray-500">
                    {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {#if apiHosts[apiId]?.url}
                  <div class="text-xs text-gray-500 truncate">
                    {apiHosts[apiId].url}
                  </div>
                {/if}
              </div>
              
              <!-- Endpoints in this API group -->
              {#each endpoints as endpoint (endpoint.id)}
                <button
                  class="flex w-full items-start gap-2 p-3 text-left transition hover:bg-gray-50"
                  on:click={() => selectEndpoint(endpoint)}
                >
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium
                    ${
                      endpoint.method === 'GET'
                        ? 'bg-green-100 text-green-800'
                        : endpoint.method === 'POST'
                          ? 'bg-blue-100 text-blue-800'
                          : endpoint.method === 'PUT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : endpoint.method === 'DELETE'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <div>
                    <div class="font-mono text-sm">{endpoint.path}</div>
                    {#if endpoint.operationId || endpoint.summary}
                      <div class="mt-1 text-xs text-gray-500">
                        {endpoint.operationId || endpoint.summary}
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
