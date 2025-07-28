<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { searchEndpoints } from '$lib/http_client/endpoints';
  import type { SearchEndpointResult } from '$lib/http_client/endpoints';
  import type { Endpoint } from './types';
  
  export let disabled: boolean = false;
  export let apiHosts: Record<string | number, { url: string; name?: string; description?: string }> = {};
  export let showSelector: boolean = false;

  const dispatch = createEventDispatcher();
  
  let searchTerm = '';
  let selectedApiId = '';
  let searchResults: SearchEndpointResult[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let showDropdown = false;
  let searchInput: HTMLInputElement;

  // Get list of all API IDs from apiHosts
  $: apiIds = Object.keys(apiHosts).map(id => parseInt(id.toString())).filter(id => !isNaN(id));
  
  // Create readable API names mapping
  $: apiNames = Object.fromEntries(
    apiIds.map(id => [
      id, 
      (apiHosts[id]?.name || `API ${id}`)
    ])
  );

  // Debounced search function
  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      showDropdown = false;
      return;
    }

    isSearching = true;
    
    try {
      const params: { query: string; apiId?: number } = { query: query.trim() };
      if (selectedApiId) {
        params.apiId = parseInt(selectedApiId);
      }
      
      const response = await searchEndpoints(params);
      searchResults = response.data;
      showDropdown = searchResults.length > 0;
    } catch (error) {
      console.error('Error searching endpoints:', error);
      searchResults = [];
      showDropdown = false;
    } finally {
      isSearching = false;
    }
  }

  // Handle search input with debouncing
  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);
  }

  // Handle API selection change
  function handleApiChange() {
    if (searchTerm.trim()) {
      performSearch(searchTerm);
    }
  }

  // Convert SearchEndpointResult to Endpoint type
  function convertToEndpoint(result: SearchEndpointResult): Endpoint {
    return {
      id: result.id,
      apiId: result.apiId,
      path: result.path,
      method: result.method,
      operationId: result.operationId,
      summary: result.summary,
      description: result.description,
      tags: result.tags
    };
  }

  function selectEndpoint(result: SearchEndpointResult) {
    const endpoint = convertToEndpoint(result);
    dispatch('select', endpoint);
    
    // Clear search and hide dropdown
    searchTerm = '';
    searchResults = [];
    showDropdown = false;
    showSelector = false;
  }

  function handleInputFocus() {
    if (searchResults.length > 0) {
      showDropdown = true;
    }
  }

  function handleInputBlur() {
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => {
      showDropdown = false;
    }, 200);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      searchTerm = '';
      searchResults = [];
      showDropdown = false;
      showSelector = false;
    }
  }
</script>

<div>
  {#if !showSelector}
    <button
      class="flex w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      on:click={() => {
        showSelector = true;
        // Focus the input after the component is shown
        setTimeout(() => {
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
      }}
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
        <h4 class="font-medium">Search Endpoints</h4>
        <button
          class="text-gray-400 hover:text-gray-600"
          aria-label="Close endpoint selector"
          on:click={() => {
            showSelector = false;
            searchTerm = '';
            searchResults = [];
            showDropdown = false;
          }}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-3">
        <!-- API Selector (only show if multiple APIs) -->
        {#if apiIds.length > 1}
          <div>
            <label for="api-select" class="block text-xs font-medium text-gray-700 mb-1">Filter by API:</label>
            <select 
              id="api-select"
              bind:value={selectedApiId} 
              on:change={handleApiChange}
              class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All APIs</option>
              {#each apiIds as apiId (apiId)}
                <option value={String(apiId)}>{apiNames[apiId] || `API ${apiId}`}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Search Input -->
        <div class="relative">
          <div class="relative">
            <input
              bind:this={searchInput}
              type="text"
              placeholder="Type to search endpoints (e.g., 'create user', 'get payment')..."
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              bind:value={searchTerm}
              on:input={handleSearchInput}
              on:focus={handleInputFocus}
              on:blur={handleInputBlur}
              on:keydown={handleKeydown}
            />
            
            <!-- Search icon -->
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              {#if isSearching}
                <svg class="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              {:else}
                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              {/if}
            </div>
          </div>

          <!-- Search Results Dropdown -->
          {#if showDropdown && searchResults.length > 0}
            <div class="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              <div class="divide-y divide-gray-100">
                {#each searchResults as result (result.id)}
                  <button
                    class="flex w-full items-start gap-2 p-3 text-left transition hover:bg-gray-50"
                    on:mousedown={() => selectEndpoint(result)}
                  >
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium shrink-0
                      ${
                        result.method === 'GET'
                          ? 'bg-green-100 text-green-800'
                          : result.method === 'POST'
                            ? 'bg-blue-100 text-blue-800'
                            : result.method === 'PUT'
                              ? 'bg-yellow-100 text-yellow-800'
                              : result.method === 'DELETE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {result.method}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="font-mono text-sm truncate">{result.path}</div>
                      {#if result.summary || result.operationId}
                        <div class="mt-1 text-xs text-gray-500 truncate">
                          {result.summary || result.operationId}
                        </div>
                      {/if}
                      {#if result.description}
                        <div class="mt-1 text-xs text-gray-400 line-clamp-2">
                          {result.description}
                        </div>
                      {/if}
                      
                      <!-- API name and relevance score -->
                      <div class="mt-1 flex items-center justify-between text-xs text-gray-400">
                        <span>{apiNames[result.apiId] || `API ${result.apiId}`}</span>
                        <span class="ml-2">Score: {result.relevanceScore.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {:else if showDropdown && searchTerm.trim() && !isSearching}
            <div class="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white p-3 shadow-lg">
              <div class="text-center text-sm text-gray-500">
                No endpoints found for "{searchTerm}"
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Help text -->
      <div class="mt-3 text-xs text-gray-500">
        Try searching with terms like "create user", "get payment", "delete order", etc.
      </div>
    </div>
  {/if}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
