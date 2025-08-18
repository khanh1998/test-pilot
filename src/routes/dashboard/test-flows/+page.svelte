<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import * as apiClient from '$lib/http_client/apis';

  let testFlows: {
    id: number;
    name: string;
    description: string;
    apis: { id: number; name: string }[];
    createdAt: string;
    updatedAt: string;
  }[] = [];

  let loading = true;
  let error: string | null = null;
  let showCreateModal = false;

  // Pagination state
  let currentPage = 1;
  let pageSize = 8;
  let totalItems = 0;
  let totalPages = 0;
  let hasNext = false;
  let hasPrev = false;

  // Search/filter state
  let searchTerm = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Form data for creating a new test flow
  let newFlowName = '';
  let newFlowDescription = '';
  let selectedApiIds: number[] = [];
  
  // Available APIs
  let availableApis: { id: number; name: string; host: string; selected?: boolean }[] = [];

  onMount(async () => {
    await fetchTestFlows();
    await fetchAvailableApis();
  });

  async function fetchTestFlows() {
    try {
      loading = true;
      error = null;

      const result = await testFlowClient.getTestFlows({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined
      });
      
      if (result) {
        testFlows = result.testFlows || [];
        if (result.pagination) {
          currentPage = result.pagination.page;
          totalItems = result.pagination.total;
          totalPages = result.pagination.totalPages;
          hasNext = result.pagination.hasNext;
          hasPrev = result.pagination.hasPrev;
        }
      } else {
        testFlows = [];
      }
    } catch (err: unknown) {
      console.error('Error fetching test flows:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }

  // Search functionality with debouncing
  function handleSearchInput() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
      currentPage = 1; // Reset to first page when searching
      fetchTestFlows();
    }, 300);
  }

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      fetchTestFlows();
    }
  }

  function nextPage() {
    if (hasNext) {
      goToPage(currentPage + 1);
    }
  }

  function prevPage() {
    if (hasPrev) {
      goToPage(currentPage - 1);
    }
  }

  async function fetchAvailableApis() {
    try {
      const result = await apiClient.getApiList();
      if (result && result.apis) {
        availableApis = result.apis as { id: number; name: string; host: string; selected?: boolean }[];
      } else {
        availableApis = [];
      }
    } catch (err: unknown) {
      console.error('Error fetching APIs:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    }
  }

  function toggleApiSelection(apiId: number) {
    if (selectedApiIds.includes(apiId)) {
      selectedApiIds = selectedApiIds.filter((id) => id !== apiId);
    } else {
      selectedApiIds = [...selectedApiIds, apiId];
    }
  }

  async function createTestFlow() {
    if (!newFlowName.trim()) {
      error = 'Test flow name is required';
      return;
    }

    if (selectedApiIds.length === 0) {
      error = 'Please select at least one API';
      return;
    }

    try {
      loading = true;
      error = null;

      // Create an api_hosts object with API IDs as keys and objects containing url and name as values
      // This will be used when running the test flow to know which host to send requests to
      const apiHosts = selectedApiIds.reduce<Record<number, {url: string, name: string}>>((hosts, apiId) => {
        const api = availableApis.find(a => a.id === apiId);
        if (api) {
          hosts[apiId] = {
            url: api.host,
            name: api.name
          };
        }
        return hosts;
      }, {});

      const result = await testFlowClient.createTestFlow({
        name: newFlowName,
        description: newFlowDescription,
        apiIds: selectedApiIds,
        flowJson: {
          settings: { 
            api_hosts: apiHosts
          },
          steps: [],
          parameters: []
        }
      });

      if (!result) {
        throw new Error('Failed to create test flow');
      }

      // Reset form and close modal
      newFlowName = '';
      newFlowDescription = '';
      selectedApiIds = [];
      showCreateModal = false;

      if (result.testFlow) {
        // Navigate to the new test flow editor
        goto(`/dashboard/test-flows/${result.testFlow.id}`);
      }
    } catch (err: unknown) {
      console.error('Error creating test flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }

  async function deleteTestFlow(id: number, name: string) {
    if (
      !confirm(
        `Are you sure you want to delete the test flow "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      loading = true;
      error = null;

      const result = await testFlowClient.deleteTestFlow(id);
      
      if (!result) {
        throw new Error('Failed to delete test flow');
      }

      // Refresh the list
      await fetchTestFlows();
    } catch (err: unknown) {
      console.error('Error deleting test flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }
</script>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Test Flows</h1>
      <p class="mt-1 text-sm text-gray-600">
        Create and manage API test sequences
      </p>
    </div>
    <div class="flex gap-3">
      <button
        class="rounded-md bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700"
        on:click={() => goto('/dashboard/test-flows/generate')}
      >
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate Flow
        </div>
      </button>
      <button
        class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        on:click={() => (showCreateModal = true)}
      >
        Create Test Flow
      </button>
    </div>
  </div>

  <!-- Search and Filter Section -->
  <div class="mb-6 flex items-center justify-between">
    <div class="flex-1 max-w-md">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search test flows by name or description..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          bind:value={searchTerm}
          on:input={handleSearchInput}
        />
      </div>
    </div>
    
    {#if totalItems > 0}
      <div class="text-sm text-gray-600">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} test flows
      </div>
    {/if}
  </div>

  {#if error}
    <div class="mb-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
      <p>{error}</p>
    </div>
  {/if}

  {#if loading && testFlows.length === 0}
    <div class="flex items-center justify-center py-12">
      <div class="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if testFlows.length === 0}
    <div class="rounded-lg bg-gray-50 p-8 text-center">
      <h3 class="mb-2 text-xl font-semibold">
        {searchTerm.trim() ? 'No Test Flows Found' : 'No Test Flows Yet'}
      </h3>
      <p class="mb-6 text-gray-600">
        {searchTerm.trim() 
          ? `No test flows match "${searchTerm}". Try adjusting your search terms.`
          : 'Create your first test flow to define reusable sequences of API calls.'
        }
      </p>
      {#if !searchTerm.trim()}
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          on:click={() => (showCreateModal = true)}
        >
          Create New Test Flow
        </button>
      {/if}
    </div>
  {:else}
    <!-- Test Flow Cards Grid -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each testFlows as flow (flow.id)}
        <div class="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="p-4">
            <h3 class="mb-2 truncate text-lg font-semibold text-gray-900">{flow.name}</h3>
            <p class="mb-3 line-clamp-2 text-sm text-gray-600 min-h-[2.5rem]">
              {flow.description || 'No description'}
            </p>

            <!-- APIs Section - More Compact -->
            {#if flow.apis.length > 0}
              <div class="mb-3">
                <div class="flex flex-wrap gap-1">
                  {#each flow.apis.slice(0, 3) as api (api.id)}
                    <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {api.name}
                    </span>
                  {/each}
                  {#if flow.apis.length > 3}
                    <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      +{flow.apis.length - 3} more
                    </span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Date and Actions -->
            <div class="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>{new Date(flow.createdAt).toLocaleDateString()}</span>
            </div>

            <!-- Action Buttons - Compact -->
            <div class="flex justify-between">
              <button
                class="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs text-red-700 transition hover:bg-red-100"
                on:click={() => deleteTestFlow(flow.id, flow.name)}
              >
                <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete
              </button>
              <a
                href="/dashboard/test-flows/{flow.id}"
                class="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 transition hover:bg-blue-100"
              >
                <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                Edit
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-8 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <button
            class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasPrev || loading}
            on:click={prevPage}
          >
            <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Previous
          </button>
          
          <div class="flex items-center space-x-1">
            {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, currentPage - 2);
              const endPage = Math.min(totalPages, startPage + 4);
              return startPage + i;
            }).filter(page => page <= totalPages) as page}
              <button
                class="px-3 py-2 text-sm font-medium rounded-md {currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}"
                on:click={() => goToPage(page)}
                disabled={loading}
              >
                {page}
              </button>
            {/each}
          </div>
          
          <button
            class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasNext || loading}
            on:click={nextPage}
          >
            Next
            <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
        
        <div class="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal for creating a new test flow -->
{#if showCreateModal}
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="mx-4 w-full max-w-lg rounded-lg bg-white p-6">
      <h2 class="mb-4 text-2xl font-bold">Create New Test Flow</h2>

      <div class="mb-4">
        <label for="flowName" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
        <input
          id="flowName"
          type="text"
          bind:value={newFlowName}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter test flow name"
        />
      </div>

      <div class="mb-4">
        <label for="flowDescription" class="mb-1 block text-sm font-medium text-gray-700"
          >Description</label
        >
        <textarea
          id="flowDescription"
          bind:value={newFlowDescription}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows="3"
          placeholder="Enter description (optional)"
        ></textarea>
      </div>

      <div class="mb-6">
        <label for="apis-select" class="mb-1 block text-sm font-medium text-gray-700"
          >Select APIs</label
        >

        {#if availableApis.length === 0}
          <p class="text-gray-500 italic">No APIs available. Please upload an API first.</p>
        {:else}
          <div class="max-h-60 overflow-y-auto rounded-md border border-gray-300 p-2">
            {#each availableApis as api (api.id)}
              <div class="flex items-center p-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  id="api-{api.id}"
                  class="mr-2"
                  checked={selectedApiIds.includes(api.id)}
                  on:change={() => toggleApiSelection(api.id)}
                />
                <label for="api-{api.id}" class="flex-grow cursor-pointer">{api.name}</label>
              </div>
              <!-- TODO: request user to optionally input API Host. Default API Host value will be taken from column `host` in table `apis` -->
              <!-- that mean, test flow setting now will have Host address for each API -->
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex justify-end">
        <button
          class="mr-2 rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
          on:click={() => {
            showCreateModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          on:click={createTestFlow}
          disabled={loading || !newFlowName.trim() || selectedApiIds.length === 0}
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}



