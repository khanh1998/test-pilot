<!-- SequenceCreator.svelte - Simple inline sequence creation form -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isCreating: boolean = false;

  const dispatch = createEventDispatcher<{
    create: { name: string };
    cancel: void;
  }>();

  let sequenceName = '';

  function handleSubmit() {
    if (sequenceName.trim()) {
      dispatch('create', { name: sequenceName.trim() });
      sequenceName = '';
      isCreating = false;
    }
  }

  function handleCancel() {
    sequenceName = '';
    isCreating = false;
    dispatch('cancel');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  }
</script>

{#if isCreating}
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <input
          bind:value={sequenceName}
          on:keydown={handleKeydown}
          placeholder="Enter sequence name..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          on:click={handleSubmit}
          disabled={!sequenceName.trim()}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          Create
        </button>
        <button
          type="button"
          on:click={handleCancel}
          class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{:else}
  <button
    type="button"
    on:click={() => (isCreating = true)}
    class="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors mb-4 flex items-center justify-center gap-2"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
    Create New Sequence
  </button>
{/if}
