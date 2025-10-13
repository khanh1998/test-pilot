<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { searchEndpoints } from '$lib/http_client/endpoints';
  import type { SearchEndpointResult } from '$lib/http_client/endpoints';
  import type { Endpoint } from './types';

  export let disabled: boolean = false;
  export let apiHosts: Record<
    string | number,
    { url: string; name?: string; description?: string }
  > = {};

  const dispatch = createEventDispatcher();

  let searchTerm = '';
  let selectedApiId = '';
  let searchResults: SearchEndpointResult[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let showDropdown = false;
  let searchInput: HTMLInputElement;
  let dropdownStyle = '';
  let isCollapsed = false;

  // Get list of all API IDs from apiHosts
  $: apiIds = Object.keys(apiHosts)
    .map((id) => parseInt(id.toString()))
    .filter((id) => !isNaN(id));

  // Create readable API names mapping
  $: apiNames = Object.fromEntries(apiIds.map((id) => [id, apiHosts[id]?.name || `API ${id}`]));

  // Simple function to position dropdown
  function positionDropdown() {
    if (searchInput) {
      const rect = searchInput.getBoundingClientRect();
      dropdownStyle = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; width: 384px; z-index: 9999;`;
    }
  }

  // Debounced search function
  async function performSearch(query: string) {
    if (!query.trim()) {
      searchResults = [];
      showDropdown = false;
      return;
    }

    isSearching = true;

    try {
      const params: { query: string; apiId?: number; apiIds?: number[] } = { query: query.trim() };
      if (selectedApiId) {
        params.apiId = parseInt(selectedApiId);
      } else {
        // If no specific API is selected, search within all APIs from apiHosts
        params.apiIds = apiIds;
      }

      const response = await searchEndpoints(params);
      searchResults = response.data;
      showDropdown = searchResults.length > 0;
      if (showDropdown) {
        positionDropdown();
      }
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
  }

  function handleInputFocus() {
    if (searchResults.length > 0) {
      positionDropdown();
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
    }
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (!isCollapsed) {
      // When expanding, focus on the search input
      setTimeout(() => {
        searchInput?.focus();
      }, 50);
    } else {
      // When collapsing, clear search state
      searchTerm = '';
      searchResults = [];
      showDropdown = false;
    }
  }

  // Update dropdown position on scroll
  function handleScroll() {
    if (showDropdown && searchInput) {
      positionDropdown();
    }
  }

  // Add scroll listener when component mounts
  onMount(() => {
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
  });

  // Remove scroll listener when component is destroyed
  onDestroy(() => {
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', handleScroll);
  });
</script>

<div>
  <!-- Search form styled to match EndpointCard dimensions -->
  <div
    class="relative max-w-[290px] min-w-[260px] flex-shrink-0 rounded-md border border-gray-200 bg-white p-2"
  >
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-sm font-medium">Add Endpoint</h4>
    </div>

    <div class="space-y-2">
      <!-- API Selector (only show if multiple APIs) -->
      {#if apiIds.length > 1}
        <div>
          <label for="api-select" class="mb-1 block text-xs font-medium text-gray-700"
            >Filter by API:</label
          >
          <select
            id="api-select"
            bind:value={selectedApiId}
            on:change={handleApiChange}
            class="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            placeholder="Search endpoints..."
            class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            bind:value={searchTerm}
            on:input={handleSearchInput}
            on:focus={handleInputFocus}
            on:blur={handleInputBlur}
            on:keydown={handleKeydown}
          />

          <!-- Search icon -->
          <div class="absolute inset-y-0 right-0 flex items-center pr-2">
            {#if isSearching}
              <svg class="h-3 w-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            {:else}
              <svg
                class="h-3 w-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            {/if}
          </div>
        </div>

        <!-- Search Results Dropdown -->
        {#if showDropdown && searchResults.length > 0}
          <div
            class="max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl"
            style={dropdownStyle}
          >
            <div class="divide-y divide-gray-100">
              {#each searchResults as result (result.id)}
                <button
                  class="flex w-full items-start gap-2 p-2 text-left transition hover:bg-gray-50"
                  on:mousedown={() => selectEndpoint(result)}
                >
                  <span
                    class={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium
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
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-mono text-xs">{result.path}</div>
                    {#if result.summary || result.operationId}
                      <div class="mt-1 truncate text-[10px] text-gray-500">
                        {result.summary || result.operationId}
                      </div>
                    {/if}
                    {#if result.description}
                      <div class="mt-1 line-clamp-2 text-[10px] text-gray-400">
                        {result.description}
                      </div>
                    {/if}

                    <!-- API name and relevance score -->
                    <div class="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span>{apiNames[result.apiId] || `API ${result.apiId}`}</span>
                      <span class="ml-2">Score: {result.relevanceScore.toFixed(2)}</span>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else if showDropdown && searchTerm.trim() && !isSearching}
          <div
            class="rounded-md border border-gray-200 bg-white p-2 shadow-xl"
            style={dropdownStyle}
          >
            <div class="text-center text-xs text-gray-500">
              No endpoints found for "{searchTerm}"
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Help text -->
    <div class="mt-2 text-[10px] text-gray-500">Try "create user", "get payment", etc.</div>
  </div>
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
