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
  
  const dispatch = createEventDispatcher();
  
  let showSelector = false;
  let searchTerm = '';
  let selectedTags: string[] = [];
  let selectedMethod = '';
  
  $: allTags = [...new Set(endpoints.flatMap(e => e.tags || []))].sort();
  
  $: filteredEndpoints = endpoints.filter(endpoint => {
    // Filter by search term
    const matchesSearch = searchTerm === '' || 
                         endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         endpoint.operationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         endpoint.summary?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by selected tags
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => endpoint.tags?.includes(tag));
    
    // Filter by HTTP method
    const matchesMethod = selectedMethod === '' || endpoint.method === selectedMethod;
    
    return matchesSearch && matchesTags && matchesMethod;
  });
  
  function selectEndpoint(endpoint: any) {
    dispatch('select', endpoint);
    showSelector = false;
    searchTerm = '';
  }
  
  function toggleTagFilter(tag: string) {
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter(t => t !== tag);
    } else {
      selectedTags = [...selectedTags, tag];
    }
  }
</script>

<div>
  {#if !showSelector}
    <button 
      class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition"
      on:click={() => showSelector = true}
    >
      <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
      </svg>
      Add Endpoint
    </button>
  {:else}
    <div class="bg-white border rounded-md shadow-sm p-4">
      <div class="flex justify-between items-center mb-4">
        <h4 class="font-medium">Select an Endpoint</h4>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => showSelector = false}
          aria-label="Close endpoint selector"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
      
      <div class="mb-4">
        <input
          type="text"
          placeholder="Search endpoints..."
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
          bind:value={searchTerm}
        />
      </div>
      
      <div class="mb-4 flex flex-wrap gap-2">
        <select 
          bind:value={selectedMethod}
          class="text-sm px-2 py-1 border rounded"
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        
        {#if allTags.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each allTags as tag}
              <button 
                class="text-xs px-2 py-1 rounded border {selectedTags.includes(tag) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'}"
                on:click={() => toggleTagFilter(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="max-h-80 overflow-y-auto border border-gray-200 rounded-md">
        {#if filteredEndpoints.length === 0}
          <div class="p-4 text-center text-gray-500">
            No endpoints found matching your filters
          </div>
        {:else}
          <div class="divide-y divide-gray-100">
            {#each filteredEndpoints as endpoint}
              <button 
                class="w-full text-left p-3 hover:bg-gray-50 transition flex items-start gap-2"
                on:click={() => selectEndpoint(endpoint)}
              >
                <span class={`px-2 py-0.5 rounded text-xs font-medium
                  ${endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : 
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                    endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'}`}
                >
                  {endpoint.method}
                </span>
                <div>
                  <div class="font-mono text-sm">{endpoint.path}</div>
                  {#if endpoint.operationId || endpoint.summary}
                    <div class="text-xs text-gray-500 mt-1">
                      {endpoint.operationId || endpoint.summary}
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
