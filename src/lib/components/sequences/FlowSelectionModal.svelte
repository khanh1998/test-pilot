<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import * as flowClient from '$lib/http_client/flows';
  import type { Flow } from '$lib/http_client/flows';

  export let isOpen = false;
  
  const dispatch = createEventDispatcher<{
    select: { flowId: number };
    close: void;
  }>();

  let searchQuery = '';
  let flows: Flow[] = [];
  let loading = false;
  let error: string | null = null;
  let searchInput: HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;

  // Debounced search function
  async function searchFlows(query: string) {
    try {
      loading = true;
      error = null;
      
      const result = await flowClient.getFlows({ 
        page: 1, 
        limit: 20, 
        search: query.trim() || undefined 
      });
      
      if (result?.flows) {
        flows = result.flows;
      }
    } catch (err) {
      console.error('Error searching flows:', err);
      error = 'Failed to search flows';
      flows = [];
    } finally {
      loading = false;
    }
  }

  // Handle search input changes with debouncing
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchFlows(searchQuery);
    }, 300);
  }

  // Load initial flows when modal opens
  $: if (isOpen && searchQuery === '') {
    searchFlows('');
  }

  // Focus search input when modal opens
  $: if (isOpen && searchInput) {
    setTimeout(() => searchInput.focus(), 100);
  }

  function handleSelect(flowId: number) {
    dispatch('select', { flowId });
    handleClose();
  }

  function handleClose() {
    searchQuery = '';
    flows = [];
    error = null;
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  onMount(() => {
    return () => {
      clearTimeout(searchTimeout);
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- Modal backdrop -->
  <div 
    class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50"
    role="presentation"
    on:click={handleClose}
    on:keydown={() => {}}
  ></div>

  <!-- Modal content -->
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <!-- Header -->
        <div class="mb-4">
          <h3 class="text-lg font-medium leading-6 text-gray-900">
            Select a Flow
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            Search and select a flow to add to this sequence.
          </p>
        </div>

        <!-- Search input -->
        <div class="mb-4">
          <label for="flow-search" class="sr-only">Search flows</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
              </svg>
            </div>
            <input
              bind:this={searchInput}
              bind:value={searchQuery}
              on:input={handleSearchInput}
              id="flow-search"
              type="text"
              placeholder="Search flows by name..."
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>

        <!-- Error message -->
        {#if error}
          <div class="mb-4 rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-700">{error}</div>
          </div>
        {/if}

        <!-- Loading state -->
        {#if loading}
          <div class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        {:else}
          <!-- Flow list -->
          <div class="max-h-64 overflow-y-auto">
            {#if flows.length === 0}
              <div class="text-center py-8 text-gray-500">
                {searchQuery ? 'No flows found matching your search.' : 'No flows available.'}
              </div>
            {:else}
              <div class="space-y-2">
                {#each flows as flow (flow.id)}
                  <button
                    type="button"
                    class="w-full text-left p-3 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    on:click={() => handleSelect(flow.id)}
                  >
                    <div class="font-medium text-gray-900">{flow.name}</div>
                    {#if flow.description}
                      <div class="text-sm text-gray-500 mt-1">{flow.description}</div>
                    {/if}
                    <div class="text-xs text-gray-400 mt-1">
                      {flow.apis?.length || 0} API{(flow.apis?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Actions -->
        <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3">
          <button
            type="button"
            class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            on:click={handleClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
