<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { Environment } from '$lib/types/environment';
  
  export let environment: Environment;

  // Confirm dialog state
  let showConfirmDialog = false;

  const dispatch = createEventDispatcher<{
    edit: { environment: Environment };
    delete: { environment: Environment };
    view: { environment: Environment };
  }>();

  function handleEdit() {
    dispatch('edit', { environment });
  }

  function handleDelete() {
    showConfirmDialog = true;
  }

  function confirmDelete() {
    dispatch('delete', { environment });
    showConfirmDialog = false;
  }

  function cancelDelete() {
    showConfirmDialog = false;
  }

  function handleView() {
    dispatch('view', { environment });
  }

  $: subEnvironments = Object.keys(environment.config.environments);
  $: variableCount = Object.keys(environment.config.variable_definitions || {}).length;
  $: linkedApiCount = environment.config.linked_apis?.length || 0;
</script>

<div class="group border border-gray-200 rounded-lg p-6 bg-white shadow-sm transition-all duration-200 ease-in-out cursor-pointer hover:shadow-md hover:border-gray-300">
  <div class="flex justify-between items-start mb-3">
    <h3 class="text-lg font-semibold text-gray-900 m-0 flex-1">{environment.name}</h3>
    <div class="flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <button class="p-2 border-0 rounded cursor-pointer transition-all duration-200 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200" onclick={handleView} aria-label="View environment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
      <button class="p-2 border-0 rounded cursor-pointer transition-all duration-200 flex items-center justify-center bg-blue-100 text-blue-800 hover:bg-blue-200" onclick={handleEdit} aria-label="Edit environment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button class="p-2 border-0 rounded cursor-pointer transition-all duration-200 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-200" onclick={handleDelete} aria-label="Delete environment">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="m19,6v14a2,2 0 0 1-2,2H7a2,2 0 0 1-2-2V6m3,0V4a2,2 0 0 1 2-2h4a2,2 0 0 1 2,2v2"></path>
        </svg>
      </button>
    </div>
  </div>

  {#if environment.description}
    <p class="text-gray-600 mb-4 text-sm leading-relaxed m-0">{environment.description}</p>
  {/if}

  <div class="grid grid-cols-2 gap-3 mb-4">
    <div class="flex justify-between items-center text-sm">
      <span class="text-gray-600 font-medium">Type:</span>
      <span class="text-gray-900 font-semibold bg-gray-100 px-2 py-1 rounded text-xs capitalize">{environment.config.type.replace('_', ' ')}</span>
    </div>
    <div class="flex justify-between items-center text-sm">
      <span class="text-gray-600 font-medium">Sub-environments:</span>
      <span class="text-gray-900 font-semibold">{subEnvironments.length}</span>
    </div>
    <div class="flex justify-between items-center text-sm">
      <span class="text-gray-600 font-medium">Variables:</span>
      <span class="text-gray-900 font-semibold">{variableCount}</span>
    </div>
    <div class="flex justify-between items-center text-sm">
      <span class="text-gray-600 font-medium">Linked APIs:</span>
      <span class="text-gray-900 font-semibold">{linkedApiCount}</span>
    </div>
  </div>

  <div class="mb-4">
    <span class="text-sm text-gray-600 font-medium mb-2 block">Environments:</span>
    <div class="flex gap-2 flex-wrap">
      {#each subEnvironments as subEnvName}
        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">{subEnvName}</span>
      {/each}
    </div>
  </div>

  <div class="border-t border-gray-100 pt-3 mt-4">
    <span class="text-xs text-gray-400">
      Created {new Date(environment.createdAt).toLocaleDateString()}
    </span>
  </div>
</div>

<!-- Confirm Delete Dialog -->
<ConfirmDialog
  bind:isOpen={showConfirmDialog}
  title="Delete Environment"
  message={`Are you sure you want to delete "${environment.name}"?`}
  confirmText="Delete"
  cancelText="Cancel"
  confirmVariant="danger"
  on:confirm={confirmDelete}
  on:cancel={cancelDelete}
/>


