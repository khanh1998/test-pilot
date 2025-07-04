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
  
  onMount(async () => {
    try {
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
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while fetching APIs';
      loading = false;
    }
  });
  
  function viewApi(apiId: number) {
    goto(`/dashboard/apis/${apiId}`);
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
          class="border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer"
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
      {/each}
    </div>
  {/if}
</div>
