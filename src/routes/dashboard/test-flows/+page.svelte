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
  let availableApis: { id: number; name: string; host: string; selected?: boolean }[] = [];

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
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test flows: ${response.statusText}`);
      }

      const data = await response.json();
      testFlows = data.testFlows || [];
    } catch (err: unknown) {
      console.error('Error fetching test flows:', err);
      error = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }

  async function fetchAvailableApis() {
    try {
      const response = await fetch('/api/apis', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch APIs: ${response.statusText}`);
      }

      const data = await response.json();
      availableApis = data.apis || [];
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

      const response = await fetch('/api/test-flows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          name: newFlowName,
          description: newFlowDescription,
          apiIds: selectedApiIds,
          flowJson: {
            settings: { api_host: '' },
            steps: [],
            assertions: [],
            variables: []
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

      const response = await fetch('/api/test-flows', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete test flow');
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

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a href="/dashboard" class="text-sm text-blue-500 hover:text-blue-600"> ← Back to Dashboard </a>
  </div>

  <div class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-bold text-gray-800">Test Flows</h1>
    <button
      class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
      on:click={() => (showCreateModal = true)}
    >
      Create Test Flow
    </button>
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
      <h3 class="mb-2 text-xl font-semibold">No Test Flows Yet</h3>
      <p class="mb-6 text-gray-600">
        Create your first test flow to define reusable sequences of API calls.
      </p>
      <button
        class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        on:click={() => (showCreateModal = true)}
      >
        Create New Test Flow
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each testFlows as flow (flow.id)}
        <div class="overflow-hidden rounded-lg bg-white shadow-md">
          <div class="p-5">
            <h3 class="mb-2 truncate text-xl font-semibold">{flow.name}</h3>
            <p class="mb-4 line-clamp-2 text-gray-600">{flow.description || 'No description'}</p>

            <div class="mb-4">
              <h4 class="mb-1 text-sm font-medium text-gray-500">APIs:</h4>
              <div class="flex flex-wrap gap-2">
                {#each flow.apis as api (api.id)}
                  <span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                    {api.name}
                  </span>
                {/each}
              </div>
            </div>

            <div class="mb-4 text-sm text-gray-500">
              Created: {new Date(flow.createdAt).toLocaleDateString()}
            </div>

            <div class="flex justify-end">
              <button
                class="mr-2 rounded bg-red-100 px-3 py-1 text-sm text-red-700 transition hover:bg-red-200"
                on:click={() => deleteTestFlow(flow.id, flow.name)}
              >
                Delete
              </button>
              <a
                href="/dashboard/test-flows/{flow.id}"
                class="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 transition hover:bg-blue-200"
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
