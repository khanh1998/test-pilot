<script lang="ts">
  import ApiEndpoints from '$lib/components/apis/ApiEndpoints.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getApiDetails, deleteApi as deleteApiCall } from '$lib/http_client/apis';

  // Define the ApiDetails type locally based on what we expect from the server
  type ApiDetails = {
    id: number;
    name: string;
    description: string | null;
    host?: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    endpointCount: number;
  };

  $: apiId = parseInt($page.params.id || '0');

  let apiName = '';
  let apiDetails: ApiDetails | null = null;
  let loading = false;
  let error: string | null = null;

  // Fetch API details on component mount
  // This is done here to get the API name for the header and delete confirmation
  // The ApiEndpoints component will fetch its own data
  
  async function fetchApiDetails() {
    try {
      const apiData = await getApiDetails(apiId);
      if (apiData) {
        apiDetails = apiData.api as ApiDetails;
        apiName = apiDetails?.name || 'API';
      } else {
        // If API not found, redirect to APIs list
        goto('/dashboard/apis');
      }
    } catch (err: unknown) {
      console.error('Failed to load API details:', err);
      error = err instanceof Error ? err.message : 'Failed to load API details';
    }
  }

  // Call fetchApiDetails when apiId changes or on initial load
  $: if (apiId) {
    fetchApiDetails();
  }

  function goToUpdatePage() {
    goto(`/dashboard/apis/${apiId}/update`);
  }
  
  async function deleteApi() {
    if (
      confirm(
        `Are you sure you want to delete "${apiName}" and all of its endpoints? This action cannot be undone.`
      )
    ) {
      try {
        loading = true;
        error = null;

        await deleteApiCall(apiId);
        
        // Navigate back to the APIs list
        goto('/dashboard/apis');
      } catch (err: unknown) {
        error = err instanceof Error ? err.message : 'Failed to delete API';
      } finally {
        loading = false;
      }
    }
  }
</script>

<div class="p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">{apiName || 'API Details'}</h1>
      <p class="mt-1 text-sm text-gray-600">Manage endpoints and API configuration</p>
    </div>
    <div class="flex space-x-4">
      <button
        on:click={goToUpdatePage}
        class="flex items-center space-x-2 rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
      >
        <svg
          class="mr-1 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          ></path>
        </svg>
        Update API
      </button>
      <button
        on:click={deleteApi}
        disabled={loading}
        class="flex items-center space-x-2 rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
      >
        {#if loading}
          <svg
            class="mr-1 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        {:else}
          <svg
            class="mr-1 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            ></path>
          </svg>
        {/if}
        Delete API
      </button>
    </div>
  </div>

  {#if error}
    <div class="mb-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
      <p>{error}</p>
    </div>
  {/if}

  <ApiEndpoints {apiId} />
</div>
