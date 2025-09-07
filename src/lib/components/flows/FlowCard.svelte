<script lang="ts">
  import type { Flow } from '$lib/http_client/flows';

  export let flow: Flow;
  export let onEdit: (flow: Flow) => void = () => {};
  export let onDelete: (id: number, name: string) => void = () => {};
  export let onSelect: (flow: Flow) => void = () => {};
  export let selectable = false;
  export let selected = false;

  function handleEdit() {
    onEdit(flow);
  }

  function handleDelete() {
    onDelete(flow.id, flow.name);
  }

  function handleSelect() {
    onSelect(flow);
  }

  // Extract flow statistics
  $: stepCount = flow.flowJson?.steps?.length || 0;
  $: apiCount = flow.apis?.length || 0;
</script>

{#if selectable}
<button 
  class="relative bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer text-left w-full {selected ? 'ring-2 ring-blue-500' : ''}"
  on:click={handleSelect}
  aria-pressed={selected}
>
  {#if selected}
    <div class="absolute top-2 right-2">
      <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    </div>
  {/if}

  <div class="flex items-start justify-between">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-medium text-gray-900 truncate">
        {flow.name}
      </h3>
      
      {#if flow.description}
        <p class="mt-1 text-sm text-gray-600 line-clamp-2">
          {flow.description}
        </p>
      {/if}
      
      <!-- Flow Stats -->
      <div class="mt-3 flex items-center space-x-4 text-sm text-gray-500">
        <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          {stepCount} step{stepCount !== 1 ? 's' : ''}
        </span>
        <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z" />
          </svg>
          {apiCount} API{apiCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  </div>
  
  <!-- API List -->
  {#if flow.apis && flow.apis.length > 0}
    <div class="mt-4 pt-4 border-t border-gray-100">
      <div class="flex flex-wrap gap-2">
        {#each flow.apis as api}
          <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {api.name}
          </span>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Footer -->
  <div class="mt-4 pt-4 border-t border-gray-100">
    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>Created {new Date(flow.createdAt).toLocaleDateString()}</span>
      {#if flow.updatedAt !== flow.createdAt}
        <span>Updated {new Date(flow.updatedAt).toLocaleDateString()}</span>
      {/if}
    </div>
  </div>
</button>
{:else}
<div class="relative bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
  <div class="flex items-start justify-between">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-medium text-gray-900 truncate">
        {flow.name}
      </h3>
      
      {#if flow.description}
        <p class="mt-1 text-sm text-gray-600 line-clamp-2">
          {flow.description}
        </p>
      {/if}
      
      <!-- Flow Stats -->
      <div class="mt-3 flex items-center space-x-4 text-sm text-gray-500">
        <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          {stepCount} step{stepCount !== 1 ? 's' : ''}
        </span>
        <span class="flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z" />
          </svg>
          {apiCount} API{apiCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="flex items-center space-x-2 ml-4">
      <button
        type="button"
        class="inline-flex items-center p-1.5 border border-transparent text-xs font-medium rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        on:click|stopPropagation={handleEdit}
        aria-label="Edit flow"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        type="button"
        class="inline-flex items-center p-1.5 border border-transparent text-xs font-medium rounded text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        on:click|stopPropagation={handleDelete}
        aria-label="Delete flow"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
  
  <!-- API List -->
  {#if flow.apis && flow.apis.length > 0}
    <div class="mt-4 pt-4 border-t border-gray-100">
      <div class="flex flex-wrap gap-2">
        {#each flow.apis as api}
          <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {api.name}
          </span>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Footer -->
  <div class="mt-4 pt-4 border-t border-gray-100">
    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>Created {new Date(flow.createdAt).toLocaleDateString()}</span>
      {#if flow.updatedAt !== flow.createdAt}
        <span>Updated {new Date(flow.updatedAt).toLocaleDateString()}</span>
      {/if}
    </div>
  </div>
</div>
{/if}
