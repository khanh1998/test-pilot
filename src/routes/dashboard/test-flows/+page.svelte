<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { projectStore, type Project } from '$lib/store/project';
  import * as testFlowClient from '$lib/http_client/test-flow';
  import * as apiClient from '$lib/http_client/apis';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import TestFlowCard from '$lib/components/test-flows/TestFlowCard.svelte';
  import CloneDialog from '$lib/components/test-flows/CloneDialog.svelte';

  let testFlows: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }[] = [];

  let loading = true;
  let error: string | null = null;
  let showCreateModal = false;

  // Project state
  let selectedProject: Project | null = null;
  let isProjectLoading = false;
  let projectError: string | null = null;

  // Pagination state - synced with URL
  let currentPage = 1;
  let pageSize = 12;
  let totalItems = 0;
  let totalPages = 0;
  let hasNext = false;
  let hasPrev = false;

  // Search/filter state - synced with URL
  let searchTerm = ''; // This reflects the actual search being performed (from URL)
  let searchInput = ''; // This is what the user types in the input field
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Control flags
  let isInitialized = false;
  let isProjectReady = false;
  let hasLoadedData = false; // Track if we've ever loaded data

  // Form data for creating a new test flow
  let newFlowName = '';
  let newFlowDescription = '';
  let selectedApiIds: number[] = [];
  
  // Available APIs
  let availableApis: { id: number; name: string; host: string; selected?: boolean }[] = [];

  // Confirm dialog state
  let showConfirmDialog = false;
  let pendingDeleteFlow: { id: number; name: string } | null = null;

  // Clone dialog state
  let showCloneDialog = false;
  let pendingCloneFlow: {
    id: number;
    name: string;
    description: string;
  } | null = null;
  let cloneLoading = false;

  // Subscribe to project store
  const unsubscribe = projectStore.subscribe((state) => {
    const previousProjectId = selectedProject?.id;
    
    selectedProject = state.selectedProject;
    isProjectLoading = state.isLoading;
    projectError = state.error;
    
    // Project is ready when it's no longer loading
    const wasProjectReady = isProjectReady;
    isProjectReady = !state.isLoading;
    
    // Initial load: fetch data when project becomes ready for the first time
    if (!wasProjectReady && isProjectReady && isInitialized) {
      loadDataFromURL();
    }
    // Project change: reload when project selection actually changes (after both are ready)
    else if (isProjectReady && isInitialized && previousProjectId !== selectedProject?.id && previousProjectId !== undefined) {
      loadDataFromURL();
    }
  });

  // Reactive statement to handle URL changes (browser back/forward)
  $: if (isInitialized && isProjectReady && $page.url.searchParams) {
    console.log('Reactive: URL changed, calling syncFromURL');
    syncFromURL();
  }

  // Sync current state with URL parameters (without fetching)
  function syncFromURL() {
    const urlParams = $page.url.searchParams;
    const urlPage = parseInt(urlParams.get('page') || '1');
    const urlSearch = urlParams.get('search') || '';
    
    console.log('syncFromURL:', { urlPage, urlSearch, currentPage, searchTerm, searchInput, hasLoadedData });
    
    // Force load on first sync, or if something actually changed
    if (!hasLoadedData || urlPage !== currentPage || urlSearch !== searchTerm) {
      console.log('State changed or first load, updating and loading data');
      currentPage = urlPage;
      searchTerm = urlSearch;
      // Also sync the input field to match the URL
      searchInput = urlSearch;
      loadData();
      fetchAvailableApis();
    } else {
      console.log('No state change, skipping load');
    }
  }



  // Load data from current URL state
  function loadDataFromURL() {
    const urlParams = $page.url.searchParams;
    currentPage = parseInt(urlParams.get('page') || '1');
    searchTerm = urlParams.get('search') || '';
    // Also sync the input field to match the URL
    searchInput = searchTerm;
    loadData();
  }

  // Load data with current state
  function loadData() {
    console.log('loadData called with:', { currentPage, searchTerm, selectedProject: selectedProject?.id });
    hasLoadedData = true; // Mark that we've loaded data at least once
    fetchTestFlows();
  }

  onMount(() => {
    isInitialized = true;
    // The project store subscriber will trigger the initial fetch when ready
  });

  onDestroy(() => {
    unsubscribe();
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  });

  async function fetchTestFlows() {
    try {
      loading = true;
      error = null;

      const result = await testFlowClient.getTestFlows({
        page: currentPage,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        projectId: selectedProject?.id
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
      // Use searchInput (what the user typed) to build the URL
      const params = new URLSearchParams();
      
      // Reset to page 1 when searching
      // Only add page param if > 1, so page 1 won't have ?page=1
      
      if (searchInput.trim()) {
        params.set('search', searchInput.trim());
      }

      const newUrl = params.toString() ? `?${params.toString()}` : '/dashboard/test-flows';
      console.log('handleSearchInput: going to', newUrl, 'with searchInput:', searchInput);
      goto(newUrl, { replaceState: true });
    }, 300);
  }

  // Pagination functions
  function goToPage(page: number) {
    console.log('goToPage called:', { page, totalPages, loading, currentPage });
    if (page >= 1 && page <= totalPages && !loading) {
      console.log('Going to page:', page);
      // Don't update currentPage here - let syncFromURL handle it
      // Just update the URL and the reactive statement will do the rest
      const params = new URLSearchParams();
      
      if (page > 1) {
        params.set('page', page.toString());
      }
      
      // Use searchTerm (current URL search state) when changing pages
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      const newUrl = params.toString() ? `?${params.toString()}` : '/dashboard/test-flows';
      console.log('goToPage: going to', newUrl);
      goto(newUrl, { replaceState: true });
    }
  }



  async function fetchAvailableApis() {
    try {
      const result = await apiClient.getApiList(selectedProject?.id);
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
        projectId: selectedProject?.id,
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
    // Show confirmation dialog
    pendingDeleteFlow = { id, name };
    showConfirmDialog = true;
  }

  async function confirmDeleteFlow() {
    if (!pendingDeleteFlow) return;

    try {
      loading = true;
      error = null;

      const result = await testFlowClient.deleteTestFlow(pendingDeleteFlow.id);
      
      if (!result) {
        throw new Error('Failed to delete test flow');
      }

      // Refresh the list (URL state is preserved)
      await fetchTestFlows();
    } catch (err: unknown) {
      console.error('Error deleting test flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
      pendingDeleteFlow = null;
      showConfirmDialog = false;
    }
  }

  function cancelDeleteFlow() {
    pendingDeleteFlow = null;
    showConfirmDialog = false;
  }

  async function handleCloneFlow(flow: typeof testFlows[0]) {
    // Show clone dialog
    pendingCloneFlow = {
      id: flow.id,
      name: flow.name,
      description: flow.description || ''
    };
    showCloneDialog = true;
  }

  async function confirmCloneFlow(event: CustomEvent<{ name: string; description: string }>) {
    if (!pendingCloneFlow) return;

    try {
      cloneLoading = true;
      error = null;

      const result = await testFlowClient.cloneTestFlow(pendingCloneFlow.id, {
        name: event.detail.name,
        description: event.detail.description
      });
      
      if (!result) {
        throw new Error('Failed to clone test flow');
      }

      // Refresh the list (URL state is preserved)
      await fetchTestFlows();

      // Navigate to the new test flow editor if successful
      if (result.testFlow) {
        goto(`/dashboard/test-flows/${result.testFlow.id}`);
      }
    } catch (err: unknown) {
      console.error('Error cloning test flow:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      cloneLoading = false;
      pendingCloneFlow = null;
      showCloneDialog = false;
    }
  }

  function cancelCloneFlow() {
    pendingCloneFlow = null;
    showCloneDialog = false;
  }
</script>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Test Flows</h1>
      <div class="mt-1">
        <p class="text-sm text-gray-600">
          Create and manage API test sequences
        </p>
        {#if selectedProject}
          <p class="text-sm text-gray-600 mt-1">
            Showing test flows for project: <span class="font-medium">{selectedProject.name}</span>
          </p>
        {:else}
          <p class="text-sm text-gray-600 mt-1">
            No project selected
          </p>
        {/if}
      </div>
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
          {#if loading && searchInput.trim()}
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          {:else}
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          {/if}
        </div>
        <input
          type="text"
          placeholder="Search test flows by name or description..."
          class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 {loading ? 'opacity-75' : ''}"
          bind:value={searchInput}
          on:input={handleSearchInput}
          disabled={loading}
        />
        {#if searchInput.trim()}
          <button
            aria-label="trim"
            type="button"
            class="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
            on:click={() => {
              searchInput = '';
              handleSearchInput();
            }}
            disabled={loading}
          >
            <svg class="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        {/if}
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
        {#if searchTerm.trim()}
          No test flows match "{searchTerm}". Try adjusting your search terms.
        {:else if selectedProject}
          No test flows found for project "{selectedProject.name}". Create your first test flow for this project.
        {:else}
          Select a project to view its test flows, or create your first test flow.
        {/if}
      </p>
      {#if !searchTerm.trim()}
        {#if selectedProject}
          <button
            class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            on:click={() => (showCreateModal = true)}
          >
            Create Test Flow for {selectedProject.name}
          </button>
        {:else}
          <div class="space-y-2">
            <div>
              <a href="/dashboard/projects" class="text-blue-500 hover:text-blue-600">
                Create or select a project
              </a>
            </div>
            <div class="text-gray-400">or</div>
            <div>
              <button
                class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                on:click={() => (showCreateModal = true)}
              >
                Create Test Flow
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- Test Flow Cards Grid -->
    <div class="relative">
      <!-- Loading overlay for existing content -->
      {#if loading && testFlows.length > 0}
        <div class="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-10 rounded-md">
          <div class="flex items-center space-x-2 bg-white px-4 py-2 rounded-md shadow-md">
            <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <span class="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      {/if}
      
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 {loading && testFlows.length > 0 ? 'pointer-events-none' : ''}">
        {#each testFlows as flow (flow.id)}
          <TestFlowCard 
            {flow} 
            onDelete={deleteTestFlow}
            onClone={handleCloneFlow}
          />
        {/each}
      </div>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-8 flex items-center justify-between relative">
        <!-- Loading overlay for pagination -->
        {#if loading}
          <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
            <div class="flex items-center space-x-2">
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              <span class="text-sm text-gray-600">Loading...</span>
            </div>
          </div>
        {/if}
        
        <div class="flex items-center space-x-2">
          <button
            class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1 || loading}
            on:click={() => goToPage(1)}
          >
            {#if loading && currentPage !== 1}
              <div class="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
            {:else}
              <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>
              </svg>
            {/if}
            First
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
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={() => goToPage(page)}
                disabled={loading}
              >
                {#if loading && currentPage === page}
                  <div class="h-4 w-4 animate-spin rounded-full border-2 {currentPage === page ? 'border-white border-t-transparent' : 'border-gray-400 border-t-transparent'}"></div>
                {:else}
                  {page}
                {/if}
              </button>
            {/each}
          </div>
          
          <button
            class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === totalPages || loading}
            on:click={() => goToPage(totalPages)}
          >
            Last
            {#if loading && currentPage !== totalPages}
              <div class="ml-1 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
            {:else}
              <svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7m-8-14l7 7-7 7"></path>
              </svg>
            {/if}
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
      <div class="mb-4">
        <h2 class="text-2xl font-bold">Create New Test Flow</h2>
        {#if selectedProject}
          <p class="text-sm text-gray-600 mt-1">
            Creating test flow for project: <span class="font-medium">{selectedProject.name}</span>
          </p>
        {/if}
      </div>

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
          <p class="text-gray-500 italic">
            {#if selectedProject}
              No APIs available for project "{selectedProject.name}". Please upload an API to this project first.
            {:else}
              No APIs available. Please select a project and upload an API first.
            {/if}
          </p>
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

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Delete Test Flow"
  message={pendingDeleteFlow ? `Are you sure you want to delete the test flow "${pendingDeleteFlow.name}"? This action cannot be undone.` : ''}
  confirmText="Delete"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDeleteFlow}
  on:cancel={cancelDeleteFlow}
/>

<!-- Clone Dialog -->
<CloneDialog
  bind:isOpen={showCloneDialog}
  originalName={pendingCloneFlow?.name || ''}
  originalDescription={pendingCloneFlow?.description || ''}
  loading={cloneLoading}
  on:confirm={confirmCloneFlow}
  on:cancel={cancelCloneFlow}
/>



