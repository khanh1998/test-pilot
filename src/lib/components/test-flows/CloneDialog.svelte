<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    confirm: { name: string; description: string };
    cancel: void;
  }>();

  export let isOpen = false;
  export let originalName = '';
  export let originalDescription = '';
  export let loading = false;

  let name = '';
  let description = '';

  $: if (isOpen) {
    name = `Copy of ${originalName}`;
    description = originalDescription;
  }

  function handleConfirm() {
    if (name.trim()) {
      dispatch('confirm', { name: name.trim(), description: description.trim() });
    }
  }

  function handleCancel() {
    dispatch('cancel');
    isOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      handleConfirm();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    on:keydown={handleKeydown}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      on:click|stopPropagation
    >
      <h2 class="mb-4 text-2xl font-bold text-gray-900">Clone Test Flow</h2>

      <div class="mb-4">
        <label for="cloneName" class="mb-1 block text-sm font-medium text-gray-700">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          id="cloneName"
          type="text"
          bind:value={name}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter test flow name"
          disabled={loading}
          required
        />
      </div>

      <div class="mb-6">
        <label for="cloneDescription" class="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="cloneDescription"
          bind:value={description}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows="3"
          placeholder="Enter description (optional)"
          disabled={loading}
        ></textarea>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50"
          on:click={handleCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          on:click={handleConfirm}
          disabled={loading || !name.trim()}
        >
          {#if loading}
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Cloning...
          {:else}
            Clone Test Flow
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
