<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
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
  
  // Form data for creating a new test flow
  let newFlowName = '';
  let newFlowDescription = '';
  let selectedApiIds: number[] = [];
  
  // Available APIs
  let availableApis: { id: number; name: string; selected?: boolean }[] = [];
  
  onMount(async () => {
    await fetchTestFlows();
    await fetchAvailableApis();
  });
  
  async function fetchTestFlows() {
    try {
      loading = true;
      error = null;
      
      const response = await fetch('/api/test-flows', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch test flows: ${response.statusText}`);
      }
      
      const data = await response.json();
      testFlows = data.testFlows || [];
    } catch (err: any) {
      console.error('Error fetching test flows:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  async function fetchAvailableApis() {
    try {
      const response = await fetch('/api/apis', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch APIs: ${response.statusText}`);
      }
      
      const data = await response.json();
      availableApis = data.apis || [];
    } catch (err: any) {
      console.error('Error fetching APIs:', err);
    }
  }
  
  function toggleApiSelection(apiId: number) {
    if (selectedApiIds.includes(apiId)) {
      selectedApiIds = selectedApiIds.filter(id => id !== apiId);
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
      
      const response = await fetch('/api/test-flows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          name: newFlowName,
          description: newFlowDescription,
          apiIds: selectedApiIds,
          flowJson: {
            settings: { cookie_mode: "auto" },
            steps: [],
            assertions: []
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create test flow');
      }
      
      const data = await response.json();
      
      // Reset form and close modal
      newFlowName = '';
      newFlowDescription = '';
      selectedApiIds = [];
      showCreateModal = false;
      
      // Navigate to the new test flow editor
      goto(`/dashboard/test-flows/${data.testFlow.id}`);
    } catch (err: any) {
      console.error('Error creating test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  async function deleteTestFlow(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete the test flow "${name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      loading = true;
      error = null;
      
      const response = await fetch('/api/test-flows', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete test flow');
      }
      
      // Refresh the list
      await fetchTestFlows();
    } catch (err: any) {
      console.error('Error deleting test flow:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold">Test Flow Blueprints</h1>
    <button
      class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
      on:click={() => showCreateModal = true}
    >
      Create New Test Flow
    </button>
  </div>
  
  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
      <span class="block sm:inline">{error}</span>
    </div>
  {/if}
  
  {#if loading && testFlows.length === 0}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else if testFlows.length === 0}
    <div class="bg-gray-50 rounded-lg p-8 text-center">
      <h3 class="text-xl font-semibold mb-2">No Test Flows Yet</h3>
      <p class="text-gray-600 mb-6">
        Create your first test flow to define reusable sequences of API calls.
      </p>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        on:click={() => showCreateModal = true}
      >
        Create New Test Flow
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each testFlows as flow}
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <div class="p-5">
            <h3 class="text-xl font-semibold mb-2 truncate">{flow.name}</h3>
            <p class="text-gray-600 mb-4 line-clamp-2">{flow.description || 'No description'}</p>
            
            <div class="mb-4">
              <h4 class="text-sm font-medium text-gray-500 mb-1">APIs:</h4>
              <div class="flex flex-wrap gap-2">
                {#each flow.apis as api}
                  <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {api.name}
                  </span>
                {/each}
              </div>
            </div>
            
            <div class="text-sm text-gray-500 mb-4">
              Created: {new Date(flow.createdAt).toLocaleDateString()}
            </div>
            
            <div class="flex justify-end">
              <button 
                class="mr-2 text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                on:click={() => deleteTestFlow(flow.id, flow.name)}
              >
                Delete
              </button>
              <a 
                href="/dashboard/test-flows/{flow.id}" 
                class="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
              >
                Edit
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal for creating a new test flow -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
      <h2 class="text-2xl font-bold mb-4">Create New Test Flow</h2>
      
      <div class="mb-4">
        <label for="flowName" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          id="flowName"
          type="text"
          bind:value={newFlowName}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter test flow name"
        />
      </div>
      
      <div class="mb-4">
        <label for="flowDescription" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="flowDescription"
          bind:value={newFlowDescription}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
          placeholder="Enter description (optional)"
        ></textarea>
      </div>
      
      <div class="mb-6">
        <label for="apis-select" class="block text-sm font-medium text-gray-700 mb-1">Select APIs</label>
        
        {#if availableApis.length === 0}
          <p class="text-gray-500 italic">No APIs available. Please upload an API first.</p>
        {:else}
          <div class="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
            {#each availableApis as api}
              <div class="flex items-center p-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  id="api-{api.id}"
                  class="mr-2"
                  checked={selectedApiIds.includes(api.id)}
                  on:change={() => toggleApiSelection(api.id)}
                />
                <label for="api-{api.id}" class="cursor-pointer flex-grow">{api.name}</label>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="flex justify-end">
        <button
          class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
          on:click={() => {
            showCreateModal = false;
            error = null;
          }}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          on:click={createTestFlow}
          disabled={loading || !newFlowName.trim() || selectedApiIds.length === 0}
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}
