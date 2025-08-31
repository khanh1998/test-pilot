<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let title = 'Confirm Action';
  export let message = 'Are you sure you want to proceed?';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let confirmVariant: 'primary' | 'danger' = 'primary';

  const dispatch = createEventDispatcher();

  function handleConfirm() {
    dispatch('confirm');
    isOpen = false;
  }

  function handleCancel() {
    dispatch('cancel');
    isOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  function handleBackdropClick() {
    handleCancel();
  }

  // Focus management and animation
  let dialogElement: HTMLDivElement;
  let confirmButton: HTMLButtonElement;
  let mounted = false;

  $: if (isOpen && confirmButton) {
    setTimeout(() => confirmButton.focus(), 100);
  }

  $: if (isOpen) {
    setTimeout(() => mounted = true, 10);
  } else {
    mounted = false;
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-out {mounted ? 'opacity-100' : 'opacity-0'}"
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
    tabindex="-1"
    bind:this={dialogElement}
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-gray-800/30 to-gray-900/20 backdrop-blur-sm transition-all duration-300 ease-in-out {mounted ? 'opacity-100' : 'opacity-0'}"
      on:click={handleBackdropClick}
      role="presentation"
      aria-hidden="true"
    ></div>

    <!-- Dialog Content -->
    <div
      class="relative z-10 w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl transform transition-all duration-300 ease-out ring-1 ring-gray-900/5 {mounted ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}"
    >
      <!-- Header -->
      <div class="px-6 pt-6">
        <h3 id="dialog-title" class="text-lg font-semibold text-gray-900">
          {title}
        </h3>
      </div>

      <!-- Content -->
      <div class="px-6 py-4">
        <p id="dialog-description" class="text-sm text-gray-600">
          {message}
        </p>
      </div>

      <!-- Actions -->
      <div class="px-6 pb-6 flex gap-3 justify-end">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          on:click={handleCancel}
        >
          {cancelText}
        </button>
        <button
          bind:this={confirmButton}
          type="button"
          class="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors {confirmVariant === 'danger'
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}"
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
