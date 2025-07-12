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

  const dispatch = createEventDispatcher();

  let showSelector = false;
  let searchTerm = '';
  let selectedTags: string[] = [];
  let selectedMethod = '';

  $: allTags = [...new Set(endpoints.flatMap((e) => e.tags || []))].sort();

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

    return matchesSearch && matchesTags && matchesMethod;
  });

  function selectEndpoint(endpoint: (typeof endpoints)[number]) {
    dispatch('select', endpoint);
    showSelector = false;
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
    <div class="rounded-md border bg-white p-4 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <h4 class="font-medium">Select an Endpoint</h4>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => (showSelector = false)}
          aria-label="Close endpoint selector"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
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
            {#each filteredEndpoints as endpoint (endpoint.id)}
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
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
