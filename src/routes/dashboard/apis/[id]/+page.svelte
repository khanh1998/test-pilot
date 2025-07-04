<script lang="ts">
  import ApiEndpoints from '$lib/components/ApiEndpoints.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  $: apiId = parseInt($page.params.id || '0');
  
  let apiName = '';
  let loading = false;
  let error: string | null = null;
  
  onMount(async () => {
    try {
      const response = await fetch(`/api/apis/${apiId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const apiData = await response.json();
        apiName = apiData.api?.name || 'API';
      }
    } catch (err) {
      // If we can't fetch the API details, we'll just use the default name
      console.error('Failed to load API details:', err);
    }
  });
  
  async function deleteApi() {
    if (confirm(`Are you sure you want to delete "${apiName}" and all of its endpoints? This action cannot be undone.`)) {
      try {
        loading = true;
        error = null;
        
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
        
        // Navigate back to the APIs list
        goto('/dashboard/apis');
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to delete API';
      } finally {
        loading = false;
      }
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <a href="/dashboard/apis" class="text-blue-500 hover:text-blue-600 text-sm">
        ← Back to APIs
      </a>
    </div>
    <button
      on:click={deleteApi}
      disabled={loading}
      class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center space-x-2 disabled:opacity-50"
    >
      {#if loading}
        <svg class="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else}
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      {/if}
      Delete API
    </button>
  </div>
  
  {#if error}
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
      <p>{error}</p>
    </div>
  {/if}
  
  <ApiEndpoints {apiId} />
</div>
