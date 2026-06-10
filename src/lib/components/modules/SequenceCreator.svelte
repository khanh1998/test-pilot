<!-- SequenceCreator.svelte - Sequence creation trigger and modal -->
<script lang="ts">
  function stopPropagation<T extends Event>(handler: (event: T) => unknown) {
    return (event: T) => {
      event.stopPropagation();
      return handler(event);
    };
  }

  interface Props {
    [key: string]: unknown;
    isCreating?: boolean;
    compact?: boolean;
  }

  let {
    isCreating = $bindable(false),
    compact = false,
    ...callbackProps
  }: Props & Record<string, unknown> = $props();

  function dispatch(eventName: string, detail?: unknown) {
    const handler = callbackProps['on' + eventName.charAt(0).toUpperCase() + eventName.slice(1)];
    if (typeof handler === 'function') {
      if (arguments.length > 1) {
        handler(detail);
      } else {
        handler();
      }
    }
  }

  let sequenceName = $state('');
  let showCreateDialog = $state(false);

  function handleSubmit() {
    if (sequenceName.trim()) {
      dispatch('create', { name: sequenceName.trim() });
      sequenceName = '';
      showCreateDialog = false;
    }
  }

  function handleCancel() {
    sequenceName = '';
    showCreateDialog = false;
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

<button
  type="button"
  onclick={() => (showCreateDialog = true)}
  disabled={isCreating}
  class={compact
    ? 'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60'
    : 'mb-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60'}
>
  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
  </svg>
  Create New Sequence
</button>

{#if showCreateDialog}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      onclick={stopPropagation(() => undefined)}
    >
      <h2 class="mb-4 text-2xl font-bold text-gray-900">Create New Sequence</h2>

      <div class="mb-6">
        <label for="sequenceName" class="mb-1 block text-sm font-medium text-gray-700">
          Sequence name <span class="text-red-500">*</span>
        </label>
        <input
          id="sequenceName"
          type="text"
          bind:value={sequenceName}
          onkeydown={handleKeydown}
          class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Enter sequence name"
          disabled={isCreating}
          required
        />
      </div>

      <div class="flex justify-end space-x-3">
        <button
          type="button"
          class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50"
          onclick={handleCancel}
          disabled={isCreating}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
          onclick={handleSubmit}
          disabled={isCreating || !sequenceName.trim()}
        >
          {#if isCreating}
            Creating...
          {:else}
            Create Sequence
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
