<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let apis: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    endpointCount: number;
  }[] = [];
  
  let loading = true;
  let error: string | null = null;
  let isDeleting = false;
  let deleteApiId: number | null = null;
  let deleteError: string | null = null;
  
  async function loadApis() {
    try {
      loading = true;
      const response = await fetch('/api/apis', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      apis = data.apis;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while fetching APIs';
    } finally {
      loading = false;
    }
  }
  
  onMount(loadApis);
  
  function viewApi(apiId: number) {
    goto(`/dashboard/apis/${apiId}`);
  }
  
  async function deleteApi(event: Event, apiId: number) {
    // Prevent the click event from bubbling up to the parent container
    event.stopPropagation();
    
    if (confirm('Are you sure you want to delete this API and all of its endpoints? This action cannot be undone.')) {
      try {
        isDeleting = true;
        deleteApiId = apiId;
        deleteError = null;
        
        const response = await fetch('/api/apis', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({ id: apiId })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to delete API (${response.status})`);
        }
        
        // Reload the API list
        await loadApis();
      } catch (err) {
        deleteError = err instanceof Error ? err.message : 'Failed to delete API';
      } finally {
        isDeleting = false;
        deleteApiId = null;
      }
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">My APIs</h1>
    <a href="/dashboard/apis/upload" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
      Upload Swagger Spec
    </a>
  </div>
  
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-pulse text-gray-500">Loading APIs...</div>
    </div>
  {:else if error}
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if deleteError}
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4" role="alert">
      <p>{deleteError}</p>
      <button 
        class="text-sm underline mt-2" 
        on:click={() => deleteError = null}
      >
        Dismiss
      </button>
    </div>
  {:else if apis.length === 0}
    <div class="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
      <h3 class="text-lg font-medium text-gray-700 mb-2">No APIs found</h3>
      <p class="text-gray-500 mb-4">Upload your first Swagger/OpenAPI specification to get started.</p>
      <a href="/dashboard/apis/upload" class="text-blue-500 hover:text-blue-600">
        Upload Swagger Spec
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each apis as api (api.id)}
        <div 
          class="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 relative"
        >
          <div 
            class="cursor-pointer"
            on:click={() => viewApi(api.id)}
            on:keydown={e => e.key === 'Enter' && viewApi(api.id)}
            tabindex="0"
            role="button"
            aria-label={`View details for API ${api.name}`}
          >
            <h2 class="text-xl font-semibold mb-2">{api.name}</h2>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">{api.description || 'No description'}</p>
            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>{api.endpointCount} endpoint{api.endpointCount === 1 ? '' : 's'}</span>
              <span>Updated {new Date(api.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <!-- Delete Button -->
          <button
            class="absolute top-2 right-2 p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none"
            on:click={(e) => deleteApi(e, api.id)}
            aria-label="Delete API"
            title="Delete API"
            disabled={isDeleting && deleteApiId === api.id}
          >
            {#if isDeleting && deleteApiId === api.id}
              <svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
