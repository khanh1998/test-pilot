<script lang="ts">
  import { page } from '$app/stores';
  import ApiFileUpload from '$lib/components/apis/ApiFileUpload.svelte';
  import { onMount } from 'svelte';
  import { getApiDetails } from '$lib/http_client/apis';

  const apiId = parseInt($page.params.id);

  let loading = true;
  let error: string | null = null;
  let api: {
    id: number;
    name: string;
    description: string | null;
    host?: string | null;
  } | null = null;

  onMount(async () => {
    try {
      const data = await getApiDetails(apiId);
      if (!data) {
        throw new Error(`Error fetching API details`);
      }
      
      api = data.api as typeof api;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while fetching API details';
    } finally {
      loading = false;
    }
  });
</script>

<div class="container mx-auto px-4 py-6">
  <div class="mb-6">
    <a href={`/dashboard/apis/${apiId}`} class="text-blue-500 hover:text-blue-700">
      &larr; Back to API Details
    </a>
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-pulse text-gray-500">Loading API details...</div>
    </div>
  {:else if error}
    <div class="my-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
      <p>{error}</p>
    </div>
  {:else if api}
    <ApiFileUpload
      apiId={api.id}
      apiName={api.name}
      apiDescription={api.description || ''}
      apiHost={api.host || ''}
    />
  {:else}
    <div class="my-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700" role="alert">
      <p>API not found</p>
    </div>
  {/if}
</div>
