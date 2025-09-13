<!-- ModuleForm.svelte - Form for creating/editing project modules -->
<script lang="ts">
  import type { ProjectModule } from '../../types/project.js';
  import { createEventDispatcher } from 'svelte';

  export let module: Partial<ProjectModule> = {};
  export let isLoading: boolean = false;
  export let mode: 'create' | 'edit' = 'create';

  const dispatch = createEventDispatcher<{
    submit: { module: Partial<ProjectModule> };
    cancel: void;
  }>();

  let name = module.name || '';
  let description = module.description || '';

  $: isValid = name.trim().length > 0;

  function handleSubmit() {
    if (!isValid) return;

    dispatch('submit', {
      module: {
        ...module,
        name: name.trim(),
        description: description.trim() || undefined,
      }
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
  <!-- Module Name -->
  <div>
    <label for="module-name" class="block text-sm font-medium text-gray-700 mb-2">
      Module Name *
    </label>
    <input
      id="module-name"
      type="text"
      bind:value={name}
      required
      maxlength="255"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter module name"
      disabled={isLoading}
    />
    {#if name.trim().length === 0 && name.length > 0}
      <p class="mt-1 text-sm text-red-600">Module name is required</p>
    {/if}
  </div>

  <!-- Module Description -->
  <div>
    <label for="module-description" class="block text-sm font-medium text-gray-700 mb-2">
      Description
    </label>
    <textarea
      id="module-description"
      bind:value={description}
      rows="3"
      maxlength="1000"
      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter module description (optional)"
      disabled={isLoading}
    ></textarea>
    <p class="mt-1 text-sm text-gray-500">{description.length}/1000 characters</p>
  </div>

  <!-- Form Actions -->
  <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
    <button
      type="button"
      on:click={handleCancel}
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      disabled={isLoading}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!isValid || isLoading}
    >
      {#if isLoading}
        <svg class="w-4 h-4 mr-2 animate-spin inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      {/if}
      {mode === 'create' ? 'Create Module' : 'Save Changes'}
    </button>
  </div>
</form>
