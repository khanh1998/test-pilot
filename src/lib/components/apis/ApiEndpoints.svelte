<script lang="ts">
  import { onMount } from 'svelte';
  import { getApiDetails } from '$lib/http_client/apis';
  import { getApiEndpoints } from '$lib/http_client/apiEndpoints';

  export let apiId: number;

  let api: {
    id: number;
    name: string;
    description: string;
    host?: string;
    createdAt: string;
    updatedAt: string;
  } | null = null;

  let endpoints: {
    id: number;
    path: string;
    method: string;
    summary: string;
    description: string;
    operationId: string;
    tags: string[];
  }[] = [];

  let loading = true;
  let error: string | null = null;

  // Group endpoints by path for better organization
  $: groupedEndpoints = endpoints.reduce(
    (acc, endpoint) => {
      if (!acc[endpoint.path]) {
        acc[endpoint.path] = [];
      }
      acc[endpoint.path].push(endpoint);
      return acc;
    },
    {} as Record<string, typeof endpoints>
  );

  // Get unique tags across all endpoints
  $: allTags = [...new Set(endpoints.flatMap((e) => e.tags || []))].sort();

  // Filter state
  let selectedTag: string = '';
  let searchQuery = '';

  // Filter endpoints by tag and search query
  $: filteredEndpointPaths = Object.keys(groupedEndpoints).filter((path) => {
    const endpointsForPath = groupedEndpoints[path];

    // If tag filter is active, check if any endpoint has the tag
    const matchesTag = !selectedTag || endpointsForPath.some((e) => e.tags?.includes(selectedTag));

    // If search is active, check if path or any endpoint info matches
    const matchesSearch =
      !searchQuery ||
      path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpointsForPath.some(
        (e) =>
          e.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.operationId?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesTag && matchesSearch;
  });

  onMount(async () => {
    try {
      const apiDetails = await getApiDetails(apiId.toString());
      if (apiDetails) {
        api = apiDetails.api;
      }

      const apiEndpoints = await getApiEndpoints(apiId.toString());
      if (apiEndpoints) {
        endpoints = apiEndpoints.endpoints;
      }
      loading = false;
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'An error occurred while fetching API data';
      loading = false;
    }
  });

  function getMethodColor(method: string) {
    const colors = {
      GET: 'bg-green-100 text-green-800',
      POST: 'bg-blue-100 text-blue-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800'
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }

  function resetFilters() {
    selectedTag = '';
    searchQuery = '';
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-8">
    {#if loading}
      <div class="animate-pulse">
        <div class="mb-2 h-8 w-1/4 rounded bg-gray-200"></div>
        <div class="h-4 w-1/2 rounded bg-gray-200"></div>
      </div>
    {:else if api}
      <h1 class="text-2xl font-bold">{api.name}</h1>
      {#if api.description}
        <p class="mt-2 text-gray-600">{api.description}</p>
      {/if}
      {#if api.host}
        <p class="text-md mt-2 font-medium text-blue-600">
          Host: <span class="font-normal">{api.host}</span>
        </p>
      {/if}
      <p class="mt-1 text-sm text-gray-500">
        Last updated: {new Date(api.updatedAt).toLocaleString()}
      </p>
    {/if}
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-pulse text-gray-500">Loading API endpoints...</div>
    </div>
  {:else if error}
    <div class="my-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
      <p>{error}</p>
    </div>
  {:else if endpoints.length === 0}
    <div class="rounded-md border border-gray-200 bg-gray-50 p-8 text-center">
      <h3 class="mb-2 text-lg font-medium text-gray-700">No endpoints found</h3>
      <p class="text-gray-500">The uploaded API specification does not contain any endpoints.</p>
    </div>
  {:else}
    <!-- Search and Filters -->
    <div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div class="flex flex-col space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-4">
        <div class="flex-grow">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search endpoints..."
            class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {#if allTags.length > 0}
          <div class="flex-shrink-0">
            <select
              bind:value={selectedTag}
              class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Tags</option>
              {#each allTags as tag (tag)}
                <option value={tag}>{tag}</option>
              {/each}
            </select>
          </div>
        {/if}

        <button
          on:click={resetFilters}
          class="flex-shrink-0 rounded-md border border-gray-300 px-3 py-2 shadow-sm hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Endpoints List -->
    {#if filteredEndpointPaths.length === 0}
      <div class="py-8 text-center text-gray-500">No endpoints match your filters.</div>
    {:else}
      <div class="space-y-6">
        {#each filteredEndpointPaths as path (path)}
          <div class="overflow-hidden rounded-lg border border-gray-200">
            <div class="border-b border-gray-200 bg-gray-50 px-4 py-2">
              <h3 class="font-mono text-sm font-medium text-gray-800">{path}</h3>
            </div>
            <div>
              {#each groupedEndpoints[path] as endpoint (endpoint.id)}
                <div class="border-t border-gray-200 first:border-t-0">
                  <div class="px-4 py-4 hover:bg-gray-50">
                    <div class="flex items-start">
                      <span
                        class="mr-3 inline-flex rounded-md px-2 py-1 text-xs font-semibold {getMethodColor(
                          endpoint.method
                        )}"
                      >
                        {endpoint.method}
                      </span>
                      <div class="flex-grow">
                        {#if endpoint.summary}
                          <h4 class="text-sm font-medium text-gray-900">{endpoint.summary}</h4>
                        {/if}
                        {#if endpoint.operationId}
                          <p class="mt-0.5 text-xs text-gray-500">
                            Operation ID: {endpoint.operationId}
                          </p>
                        {/if}
                        {#if endpoint.description}
                          <p class="mt-2 text-sm text-gray-600">{endpoint.description}</p>
                        {/if}
                        {#if endpoint.tags && endpoint.tags.length > 0}
                          <div class="mt-2 flex flex-wrap gap-1">
                            {#each endpoint.tags as tag (tag)}
                              <span
                                class="inline-flex cursor-pointer items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-200"
                                on:click={() => (selectedTag = tag)}
                                on:keydown={(e) => e.key === 'Enter' && (selectedTag = tag)}
                                tabindex="0"
                                role="button"
                              >
                                {tag}
                              </span>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
